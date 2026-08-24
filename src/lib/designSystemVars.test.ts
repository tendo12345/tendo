import { describe, expect, it } from 'vitest';
import type { CSSProperties } from 'react';
import { buildModes } from '../engine/darkMode';
import { generateDesignSystem } from '../engine';
import { designSystemStyleVars, designSystemStyleVarsForMode } from './designSystemVars';

// The `--ds-*` vars are typed as CSSProperties (a real DOM style object at runtime) but that
// type has no index signature for custom properties, so tests read them through this cast
// rather than fighting TypeScript at every access — the underlying object is a plain
// Record<string, string> either way (see designSystemVars.ts).
function asRecord(vars: CSSProperties): Record<string, string | number | undefined> {
  return vars as Record<string, string | number | undefined>;
}

// One dark-generated system (fintech) and one light-generated system (ecommerce/luxury),
// so both derivation directions (dark -> derived light, light -> derived dark) are exercised.
const fintech = generateDesignSystem({ productType: 'fintech', keywords: ['mobile', 'trustworthy'] });
const shop = generateDesignSystem({ productType: 'ecommerce', keywords: ['luxury', 'minimal'] });

describe('designSystemStyleVarsForMode', () => {
  it('reproduces the base vars for the generated mode', () => {
    for (const output of [fintech, shop]) {
      const base = asRecord(designSystemStyleVars(output));
      const modes = buildModes(output);
      const generated = modes.find((m) => m.isGenerated)!;

      const forGenerated = asRecord(designSystemStyleVarsForMode(output, generated));

      expect(forGenerated['--ds-primary']).toBe(base['--ds-primary']);
      expect(forGenerated['--ds-background']).toBe(base['--ds-background']);
      expect(forGenerated['--ds-foreground']).toBe(base['--ds-foreground']);
    }
  });

  it('swaps every colour var for the derived mode, in both directions', () => {
    for (const output of [fintech, shop]) {
      const base = asRecord(designSystemStyleVars(output));
      const modes = buildModes(output);
      const derived = modes.find((m) => !m.isGenerated)!;

      const forDerived = asRecord(designSystemStyleVarsForMode(output, derived));

      // Background is the clearest signal: the derived mode is always the opposite of
      // whichever mode the engine actually generated.
      expect(forDerived['--ds-background']).not.toBe(base['--ds-background']);
      expect(forDerived['--ds-foreground']).not.toBe(base['--ds-foreground']);
    }
  });

  it('leaves typography, spacing, radius and shadows untouched — only colour is mode-dependent', () => {
    for (const output of [fintech, shop]) {
      const base = asRecord(designSystemStyleVars(output));
      const modes = buildModes(output);
      const derived = modes.find((m) => !m.isGenerated)!;
      const forDerived = asRecord(designSystemStyleVarsForMode(output, derived));

      expect(forDerived['--ds-font-heading']).toBe(base['--ds-font-heading']);
      expect(forDerived['--ds-font-body']).toBe(base['--ds-font-body']);
      expect(forDerived['--ds-button-radius']).toBe(base['--ds-button-radius']);
      expect(forDerived['--ds-button-padding']).toBe(base['--ds-button-padding']);
      expect(forDerived['--ds-card-shadow']).toBe(base['--ds-card-shadow']);

      for (const s of output.spacing) {
        expect(forDerived[s.token]).toBe(base[s.token]);
      }
    }
  });

  it('produces a real hex colour for every colour var, never leaving one blank', () => {
    const modes = buildModes(fintech);
    for (const mode of modes) {
      const vars = asRecord(designSystemStyleVarsForMode(fintech, mode));
      for (const key of ['--ds-primary', '--ds-background', '--ds-foreground', '--ds-border', '--ds-destructive']) {
        expect(vars[key], `${mode.mode} ${key}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});
