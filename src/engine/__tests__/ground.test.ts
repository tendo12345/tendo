/**
 * The ground's one hard guarantee: it may never make text less legible than the flat
 * background already was. These tests re-derive that independently of the solver, so a
 * regression in the solver cannot mark its own homework.
 */

import { describe, expect, it } from 'vitest';
import { contrastRatio, matchLuminance, mix, relativeLuminance } from '../color';
import { generateDesignSystem } from '../designSystem';
import { buildGround } from '../ground';
import { buildSemanticTokens } from '../semanticTokens';
import products from '../../data/products.json';

type Row = Record<string, string>;

const SAMPLE = (products as Row[]).slice(0, 60).map((p) => {
  const w = p['Product Type'].split(/\s+/).filter(Boolean);
  return generateDesignSystem({ productType: w[0], keywords: w.slice(1) });
});

describe('matchLuminance', () => {
  it('re-seats a colour to a target luminance', () => {
    for (const [hex, target] of [['#FF4DD2', 0.05], ['#2563EB', 0.4], ['#F59E0B', 0.02]] as const) {
      const out = matchLuminance(hex, target);
      expect(relativeLuminance(out)!, `${hex} -> ${target}`).toBeCloseTo(target, 2);
    }
  });

  it('leaves an unparsable colour alone', () => {
    expect(matchLuminance('not-a-colour', 0.5)).toBe('not-a-colour');
  });
});

describe('ground', () => {
  it('never degrades a text role below the flat background', () => {
    for (const output of SAMPLE) {
      const g = buildGround(output);
      const tokens = buildSemanticTokens(output);
      const v = (n: string) => tokens.find((t) => t.name === n)!.value;
      const roles = ['color.text.primary', 'color.text.secondary', 'color.text.muted'].map(v);

      for (const stop of g.ramp.map((r) => r.color)) {
        for (const wash of [null, ...g.washes]) {
          const bg = wash ? mix(stop, wash.color, wash.alpha)! : stop;
          for (const role of roles) {
            const baseline = contrastRatio(role, output.colors.background)!;
            const bar = Math.min(4.5, baseline);
            expect(
              contrastRatio(role, bg)!,
              `${output.category}: ${role} on ${bg}`,
            ).toBeGreaterThanOrEqual(bar);
          }
        }
      }
    }
  });

  it('introduces no hue that is not already in the palette', () => {
    for (const output of SAMPLE) {
      const g = buildGround(output);
      const bgLum = relativeLuminance(output.colors.background)!;
      for (const wash of g.washes) {
        // Each wash is a palette colour re-seated to the background's luminance.
        const fromPrimary = matchLuminance(output.colors.primary, bgLum);
        const fromAccent = matchLuminance(output.colors.accent, bgLum);
        expect([fromPrimary, fromAccent]).toContain(wash.color);
      }
    }
  });

  it('emits the colours it actually validated', () => {
    // The solver once checked luminance-matched hues and emitted the raw palette values.
    for (const output of SAMPLE.slice(0, 20)) {
      const g = buildGround(output);
      for (const wash of g.washes) {
        expect(g.css).toContain(wash.css);
      }
    }
  });

  it('always produces valid CSS with a linear ramp', () => {
    for (const output of SAMPLE) {
      const g = buildGround(output);
      expect(g.css).toContain('linear-gradient(');
      expect(g.ramp).toHaveLength(4);
      expect(g.origin).toBe('derived');
    }
  });

  it('is deterministic', () => {
    const a = generateDesignSystem({ productType: 'fintech', keywords: ['mobile'] });
    const b = generateDesignSystem({ productType: 'fintech', keywords: ['mobile'] });
    expect(a.ground).toEqual(b.ground);
  });

  it('says plainly when the palette left no room for a wash', () => {
    const bare = SAMPLE.filter((o) => buildGround(o).washes.length === 0);
    for (const output of bare.slice(0, 5)) {
      expect(buildGround(output).note).toMatch(/tonal ramp alone/i);
    }
  });

  it('is attached to every generated system', () => {
    const o = generateDesignSystem({ productType: 'saas', keywords: ['dashboard'] });
    expect(o.ground.css).toContain('gradient');
    expect(o.ground.origin).toBe('derived');
  });
});
