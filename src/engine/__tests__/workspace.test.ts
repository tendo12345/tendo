/**
 * Tests for the Phase A derived layers: provenance, match quality, semantic tokens, DNA.
 *
 * The governing rule across all of them: nothing may invent precision. These tests assert
 * that fallbacks stay visible, that derived values are labelled as derived, and that no
 * trait or token claims a source it does not have.
 */

import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../color';
import { generateDesignSystem } from '../designSystem';
import { assessMatchQuality, fallbackDimensions } from '../matchQuality';
import { buildComponentTokenMap, buildSemanticTokens, groupTokens } from '../semanticTokens';
import { buildSystemDna } from '../systemDna';
import products from '../../data/products.json';

type Row = Record<string, string>;

const fintech = generateDesignSystem({ productType: 'fintech', keywords: ['mobile', 'trustworthy'] });
const saas = generateDesignSystem({ productType: 'saas', keywords: ['dashboard', 'dark'] });
const nonsense = generateDesignSystem({ productType: 'zzzz', keywords: ['qwerty', 'flurb'] });

const ALL = (products as Row[]).slice(0, 40).map((p) => {
  const words = p['Product Type'].split(/\s+/).filter(Boolean);
  return generateDesignSystem({ productType: words[0], keywords: words.slice(1) });
});

describe('provenance', () => {
  it('records how the style was selected', () => {
    expect(fintech.provenance.style.path).toBe('exact-match');
    expect(fintech.provenance.style.priorities).toContain('Minimalism');
  });

  it('records which reasoning row matched and how', () => {
    expect(fintech.provenance.reasoningRule.category).toBe('Fintech/Crypto');
    expect(['exact', 'partial', 'keyword']).toContain(fintech.provenance.reasoningRule.matchKind);
  });

  it('records token sources', () => {
    expect(['style', 'default']).toContain(fintech.provenance.tokens.radius);
    expect(['style', 'default']).toContain(fintech.provenance.tokens.motion);
  });

  it('carries BM25 scores without letting them change the result', () => {
    // Same input twice must still be identical — provenance is observational only.
    const a = generateDesignSystem({ productType: 'fintech', keywords: ['mobile'] });
    const b = generateDesignSystem({ productType: 'fintech', keywords: ['mobile'] });
    expect(a).toEqual(b);
    expect(a.provenance.colors.score).toBeGreaterThan(0);
  });

  it('marks unmatched domains as not matched', () => {
    expect(nonsense.provenance.product.matched).toBe(false);
  });
});

describe('match quality', () => {
  it('never reports a numeric confidence', () => {
    const q = assessMatchQuality(fintech);
    for (const assessment of Object.values(q)) {
      expect(assessment.label).not.toMatch(/\d+\s*%/);
      expect(assessment.basis).not.toMatch(/\d+\s*%\s*(confident|confidence)/i);
    }
  });

  it('labels every dimension', () => {
    const q = assessMatchQuality(saas);
    for (const [dimension, assessment] of Object.entries(q)) {
      expect(assessment.label.length, dimension).toBeGreaterThan(0);
      expect(assessment.basis.length, dimension).toBeGreaterThan(20);
      expect(['strong', 'good', 'weak', 'fallback']).toContain(assessment.level);
    }
  });

  it('flags a fallback as a fallback rather than a weak match', () => {
    const q = assessMatchQuality(nonsense);
    expect(q.product.isFallback).toBe(true);
    expect(q.product.level).toBe('fallback');
    expect(q.product.basis).toMatch(/default/i);
  });

  it('reports token fallbacks when the style declares nothing', () => {
    const q = assessMatchQuality(fintech);
    // Accessible & Ethical declares no radius, so this must surface as a fallback.
    expect(q.radius.isFallback).toBe(fintech.provenance.tokens.radius === 'default');
  });

  it('lists fallback dimensions by name', () => {
    const list = fallbackDimensions(nonsense);
    expect(Array.isArray(list)).toBe(true);
    expect(list).toContain('product');
  });

  it('holds up across many real product types', () => {
    for (const output of ALL) {
      const q = assessMatchQuality(output);
      expect(Object.keys(q)).toHaveLength(8);
      for (const a of Object.values(q)) {
        expect(a.basis.length).toBeGreaterThan(10);
      }
    }
  });
});

describe('semantic tokens', () => {
  const tokens = buildSemanticTokens(fintech);

  it('exposes the documented semantic roles', () => {
    const names = tokens.map((t) => t.name);
    for (const required of [
      'color.action.primary', 'color.action.secondary', 'color.surface.default',
      'color.surface.raised', 'color.text.primary', 'color.text.secondary',
      'color.text.muted', 'color.border.default', 'color.feedback.success',
      'color.feedback.warning', 'color.feedback.error',
    ]) {
      expect(names, `${required} missing`).toContain(required);
    }
  });

  it('does not change the underlying palette', () => {
    const primary = tokens.find((t) => t.name === 'color.action.primary');
    expect(primary?.value).toBe(fintech.colors.primary);
    const surface = tokens.find((t) => t.name === 'color.surface.default');
    expect(surface?.value).toBe(fintech.colors.background);
  });

  it('labels derived values as derived, never as generated', () => {
    const secondary = tokens.find((t) => t.name === 'color.text.secondary');
    expect(secondary?.origin).toBe('derived');
    expect(secondary?.source).toMatch(/colors\.foreground/);
  });

  it('says when a text fade was cut short to keep it readable', () => {
    // The fade backs off on tight palettes; when it does, the source must say so rather
    // than reporting the nominal percentage it did not actually use.
    for (const output of ALL) {
      const muted = buildSemanticTokens(output).find((t) => t.name === 'color.text.muted')!;
      if (/would drop below/.test(muted.source)) {
        expect(muted.source).toMatch(/faded \d+% toward the background/);
      }
    }
  });

  it('never derives text that fails AA against its own background', () => {
    // The whole point of the change: a fixed 50% mix parked muted text on the 4.5 line.
    for (const output of ALL) {
      for (const name of ['color.text.secondary', 'color.text.muted']) {
        const token = buildSemanticTokens(output).find((t) => t.name === name)!;
        const ratio = contrastRatio(token.value, output.colors.background) ?? 0;
        expect(ratio, `${output.category} ${name}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('admits that success and warning are Basis defaults, not dataset values', () => {
    for (const name of ['color.feedback.success', 'color.feedback.warning']) {
      const t = tokens.find((x) => x.name === name);
      expect(t?.origin).toBe('default');
      expect(t?.source).toMatch(/dataset has no/i);
    }
  });

  it('gives every token a role and at least one usage', () => {
    for (const t of tokens) {
      expect(t.role.length, t.name).toBeGreaterThan(0);
      expect(t.usedBy.length, t.name).toBeGreaterThan(0);
      expect(t.value.length, t.name).toBeGreaterThan(0);
    }
  });

  it('emits valid colour values for every colour token', () => {
    for (const t of tokens.filter((x) => x.group === 'color')) {
      expect(t.value, t.name).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('groups tokens for display without losing any', () => {
    const grouped = groupTokens(tokens);
    const total = grouped.reduce((n, [, list]) => n + list.length, 0);
    expect(total).toBe(tokens.length);
  });

  it('works on every sampled product type', () => {
    for (const output of ALL) {
      const list = buildSemanticTokens(output);
      expect(list.length).toBeGreaterThan(15);
      for (const t of list.filter((x) => x.group === 'color')) {
        expect(t.value, `${output.category} ${t.name}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});

describe('component token mapping', () => {
  const map = buildComponentTokenMap(fintech);

  it('maps every generated component', () => {
    expect(map.map((m) => m.component)).toEqual(['Primary button', 'Card', 'Input', 'Modal']);
  });

  it('binds component properties to real token values', () => {
    const button = map[0];
    const bg = button.bindings.find((b) => b.property === 'Background');
    expect(bg?.token).toBe('color.action.primary');
    expect(bg?.value).toBe(fintech.colors.primary);

    const radius = button.bindings.find((b) => b.property === 'Radius');
    expect(radius?.value).toBe(fintech.components.button.radius);
  });
});

describe('system DNA', () => {
  it('derives traits with quotable evidence from real fields', () => {
    const dna = buildSystemDna(fintech);
    expect(dna.traits.length).toBeGreaterThan(0);
    for (const t of dna.traits) {
      expect(t.field.length).toBeGreaterThan(0);
      expect(t.evidence.length).toBeGreaterThan(0);
      // The evidence must actually be text the engine produced.
      const haystack = JSON.stringify(fintech).toLowerCase();
      expect(haystack).toContain(t.evidence.replace(/…$/, '').slice(0, 40).toLowerCase());
    }
  });

  it('never scores a trait numerically', () => {
    const dna = buildSystemDna(saas);
    expect(JSON.stringify(dna.traits)).not.toMatch(/\d+\s*%/);
  });

  it('reports at most five traits so the character stays legible', () => {
    for (const output of ALL) {
      expect(buildSystemDna(output).traits.length).toBeLessThanOrEqual(5);
    }
  });

  it('says so plainly when there is nothing to describe', () => {
    const bare = buildSystemDna({
      ...fintech,
      style: { ...fintech.style, keywords: '', name: '', best_for: '', accessibility: '' },
      typography: { ...fintech.typography, mood: '' },
      colors: { ...fintech.colors, notes: '' },
      key_effects: '',
    });
    expect(bare.traits).toHaveLength(0);
    expect(bare.summary).toMatch(/cannot be summarised/i);
  });

  it('matches whole words only', () => {
    // "screen reader friendly" must not make an accessibility style read as Playful.
    const dna = buildSystemDna(fintech);
    expect(dna.traits.map((t) => t.trait)).not.toContain('Playful');
  });

  it('will not describe a system as something its own anti-patterns forbid', () => {
    // Fintech/Crypto records "Playful design" as an anti-pattern.
    expect(fintech.anti_patterns.toLowerCase()).toContain('playful');
    expect(buildSystemDna(fintech).traits.map((t) => t.trait)).not.toContain('Playful');

    // The veto is targeted, not blanket: a system that wants playfulness keeps it.
    const kids = generateDesignSystem({ productType: 'education', keywords: ['kids', 'playful'] });
    if (!kids.anti_patterns.toLowerCase().includes('playful')) {
      expect(buildSystemDna(kids).traits.map((t) => t.trait)).toContain('Playful');
    }
  });

  it('does not read WCAG contrast as visual energy', () => {
    // "High contrast" in an accessibility style describes legibility, not loudness.
    expect(fintech.style.keywords.toLowerCase()).toContain('high contrast');
    expect(buildSystemDna(fintech).traits.map((t) => t.trait)).not.toContain('Energetic');
  });

  it('separates countable measures from character traits', () => {
    const dna = buildSystemDna(fintech);
    const labels = dna.measures.map((m) => m.label);
    expect(labels).toContain('Ground');
    expect(labels).toContain('Spacing step');
    for (const m of dna.measures) expect(m.note.length).toBeGreaterThan(10);
  });
});
