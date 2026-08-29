import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every `--app-*` a stylesheet reads must actually be defined.
 *
 * This guards a bug class that has landed three separate times in this codebase, and its
 * defining property is that nothing looks broken when it happens:
 *
 *   - `--app-positive-ink` / `--app-warning-ink` / `--app-negative-ink` — 14 references, none
 *     defined. Every one rendered its hard-coded fallback: #15803D, #B45309, #B91C1C, a green,
 *     amber and red from the palette before Monad.
 *   - `--app-bg` — 8 references, never defined, and used for `color`. An unresolvable var makes
 *     the declaration invalid at computed-value time, so `color` fell back to the INHERITED
 *     value: ink on ink. Button labels were literally invisible.
 *   - `--app-warning-wash` / `--app-surface-2` — 9 references, never defined, quietly rendering
 *     pre-Monad amber and a neutral grey long after the palette had moved on.
 *
 * The mechanism is always the same: a token remap cannot reach a name that does not exist. A
 * restyle updates every real token and silently skips these, so the old design survives in
 * exactly the places nobody thinks to check. A `var()` fallback makes it worse, not better —
 * it guarantees something plausible renders.
 *
 * Custom properties are resolved at runtime, so neither TypeScript nor the CSS build can catch
 * this. That is why it is a test.
 */

/*
  Read from disk, not through Vite's glob.

  `import.meta.glob(..., { query: '?raw' })` looks tidier and does not work: vitest leaves CSS
  unprocessed by default, so CSS entries resolve to stubs rather than text and the scan finds
  nothing — a guard that passes while checking nothing at all.

  Node builtins are fine HERE because tests compile under tsconfig.test.json, separate from the
  app config. Nothing in src/ that ships may import them; that is what keeps the engine
  browser-importable.
*/
const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    // The tests themselves quote token names in prose; scanning them would report matches no
    // stylesheet ever renders.
    else if (/\.(css|tsx|ts)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const read = (f: string) => readFileSync(f, 'utf8');

/** Tokens defined anywhere in the global stylesheets. */
const defined = new Set<string>();
for (const file of files) {
  if (!file.includes(join('src', 'styles'))) continue;
  for (const m of read(file).matchAll(/(--app-[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
}

interface Reference {
  token: string;
  file: string;
  hasFallback: boolean;
}

const references: Reference[] = [];
for (const file of files) {
  for (const m of read(file).matchAll(/var\(\s*(--app-[a-z0-9-]+)\s*([,)])/g)) {
    references.push({
      token: m[1],
      file: file.replace(process.cwd(), '').replace(/\\/g, '/'),
      hasFallback: m[2] === ',',
    });
  }
}

describe('--app-* custom properties', () => {
  it('defines a meaningful number of tokens, so a broken scan cannot pass vacuously', () => {
    // Without this, a regex that silently stops matching would make every assertion below
    // trivially true and the guard would report success while checking nothing.
    expect(defined.size).toBeGreaterThan(50);
    expect(references.length).toBeGreaterThan(100);
  });

  it('never reads a token that is not defined', () => {
    const missing = references.filter((r) => !defined.has(r.token));
    const detail = [...new Set(missing.map((r) => `${r.token} <- ${r.file}`))].sort();

    expect(
      missing.length,
      missing.length
        ? `\n${detail.join('\n')}\n\nDefine these in src/styles/tokens.css, or point them at a ` +
          `token that exists. A var() fallback is not a fix: it renders a value the design ` +
          `system cannot reach, which is how this shipped pre-Monad colours three times.\n`
        : '',
    ).toBe(0);
  });

  it('keeps every token the dark theme overrides in the light palette too', () => {
    // A --app-dark-* with no light-mode counterpart means one theme silently inherits the
    // other's value — the two blocks drifting apart in the direction that is hardest to see.
    const darkOnly = [...defined]
      .filter((t) => t.startsWith('--app-dark-'))
      .map((t) => t.replace('--app-dark-', '--app-'))
      .filter((light) => !defined.has(light) && !light.startsWith('--app-ground'));

    expect(darkOnly, `dark-only tokens with no light definition: ${darkOnly.join(', ')}`).toEqual([]);
  });
});
