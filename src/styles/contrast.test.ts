import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../engine/color';

/*
  Read from disk, not through Vite.

  `import tokens from './tokens.css?raw'` looks tidier and does not work: vitest leaves CSS
  unprocessed by default, so the import resolves to a stub and every regex below silently
  matches nothing — a guard that passes while checking an empty string.

  Node builtins are fine HERE because tests compile under tsconfig.test.json, which is separate
  from the app config. Nothing in src/ that ships may import them; that is what keeps the engine
  browser-importable.
*/
const CSS = readFileSync(join(process.cwd(), 'src', 'styles', 'tokens.css'), 'utf8');

/**
 * The app chrome's own contrast floor, asserted rather than commented.
 *
 * tokens.css states measured ratios throughout — "14.05:1 on parchment", "4.67:1 on the raised
 * surface". Those numbers were true when written, and nothing stops a later palette change from
 * leaving them behind. A comment that lies is worse than no comment, because it is the thing a
 * reader trusts instead of re-measuring.
 *
 * This reads the real values out of tokens.css and checks the pairings the design actually
 * renders, in both themes. It is the durable half of a browser sweep: it cannot see layout, but
 * it needs no headless browser and it runs in milliseconds.
 *
 * What it deliberately does NOT cover: generated `--ds-*` colours. Those belong to the engine
 * and are asserted in engine/__tests__ against the palettes the engine produced.
 */

/** Pull a token's literal hex out of tokens.css. Only flat hex values are usable here. */
function token(name: string): string {
  const match = CSS.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  if (!match) throw new Error(`${name} is not defined as a flat hex in tokens.css`);
  return match[1];
}

const AA = 4.5;
/** WCAG 1.4.11: a control boundary or other non-text indicator needs 3:1, not 4.5. */
const UI = 3;

interface Pair {
  label: string;
  fg: string;
  bg: string;
  min: number;
}

function theme(prefix: '' | 'dark-'): Pair[] {
  const t = (n: string) => token(`--app-${prefix}${n}`);
  const surfaces: Array<[string, string]> = [
    ['paper', t('paper')],
    ['surface', t('surface')],
    ['surface-sunken', t('surface-sunken')],
    ['warning-wash', t('warning-wash')],
  ];
  const texts: Array<[string, string]> = [
    ['ink', t('ink')],
    ['ink-muted', t('ink-muted')],
    ['ink-faint', t('ink-faint')],
  ];

  const pairs: Pair[] = [];
  for (const [sn, sv] of surfaces) {
    for (const [tn, tv] of texts) {
      pairs.push({ label: `${prefix || 'light '}${tn} on ${sn}`, fg: tv, bg: sv, min: AA });
    }
  }

  // The accent carries white/ink labels on a saturated fill, and ink sits on the one coloured
  // surface. Both are body-text pairings, so both take the full AA bar.
  pairs.push({ label: `${prefix || 'light '}accent-ink on accent`, fg: t('accent-ink'), bg: t('accent'), min: AA });
  pairs.push({ label: `${prefix || 'light '}ink on accent-soft`, fg: t('ink'), bg: t('accent-soft'), min: AA });

  // Control boundaries are not text.
  pairs.push({ label: `${prefix || 'light '}border-strong on paper`, fg: t('border-strong'), bg: t('paper'), min: UI });
  pairs.push({ label: `${prefix || 'light '}focus ring on paper`, fg: t(prefix ? 'accent' : 'focus-ring'), bg: t('paper'), min: UI });

  return pairs;
}

describe('app chrome contrast', () => {
  const pairs = [...theme(''), ...theme('dark-')];

  it('checks both themes, so a light-only fix cannot pass', () => {
    // Guards against the scan silently matching nothing — the failure mode that would make
    // every assertion below vacuously true.
    expect(pairs.length).toBeGreaterThanOrEqual(28);
  });

  it.each(pairs)('$label clears its bar', ({ label, fg, bg, min }) => {
    const ratio = contrastRatio(fg, bg) ?? 0;
    expect(ratio, `${label}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1, needs ${min}:1`).toBeGreaterThanOrEqual(min);
  });

  /*
    The faint role is the one with no headroom, and it is why --app-warning-wash tints DARKER in
    dark mode than the surface it sits on. If a future change lightens that token, this is the
    assertion that catches it — the generic loop above would too, but this states the reason.
  */
  it('keeps the faint role legible on the warning wash in both themes', () => {
    for (const prefix of ['', 'dark-'] as const) {
      const faint = token(`--app-${prefix}ink-faint`);
      const wash = token(`--app-${prefix}warning-wash`);
      const ratio = contrastRatio(faint, wash) ?? 0;
      expect(ratio, `${prefix || 'light '}faint on warning wash`).toBeGreaterThanOrEqual(AA);
    }
  });
});
