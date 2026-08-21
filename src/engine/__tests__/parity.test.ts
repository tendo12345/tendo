/**
 * Parity tests against the Python CLI.
 *
 * `fixtures/python-ground-truth.json` is the verbatim output of
 * `DesignSystemGenerator.generate()` from the ui-ux-pro-max skill at commit 7538cfb, the
 * revision installed on this machine. Regenerate with scripts/capture-ground-truth.py.
 *
 * The engine is a faithful port everywhere except the style matcher, which was
 * deliberately fixed. Palettes, fonts, patterns and categories must still match exactly;
 * style changes are allowed only where `intended-divergence.json` records them.
 */

import { describe, expect, it } from 'vitest';
import { generateDesignSystem } from '../designSystem';
import { STYLE_PRIORITY_ALIASES, UNRESOLVED_STYLE_PRIORITIES } from '../stylePriority';
import type { GenerateInput, PythonParityOutput } from '../types';
import groundTruth from './fixtures/python-ground-truth.json';
import styles from '../../data/styles.json';
import { expectParity } from './parityHelpers';

/**
 * The Python CLI takes one query string. The TS function takes structured input, so each
 * case records how the query decomposes. Joined back together they must reproduce the
 * exact string the Python was given, or the comparison is meaningless.
 */
const CASES: Array<{ query: string; input: GenerateInput }> = [
  {
    // The industry-neutral case the README and CLI lead with.
    query: 'general purpose app clean',
    input: { productType: 'general', keywords: ['purpose', 'app', 'clean'] },
  },
  {
    query: 'fintech mobile trustworthy',
    input: { productType: 'fintech', keywords: ['mobile', 'trustworthy'] },
  },
  {
    query: 'portfolio minimal editorial',
    input: { productType: 'portfolio', keywords: ['minimal', 'editorial'] },
  },
  {
    query: 'saas dashboard dark',
    input: { productType: 'saas', keywords: ['dashboard', 'dark'] },
  },
  {
    query: 'crypto wallet emerging market',
    input: { productType: 'crypto wallet', keywords: ['emerging', 'market'] },
  },
];

const truth = groundTruth as Record<string, PythonParityOutput>;

describe('query construction', () => {
  it.each(CASES)('rebuilds the Python query for "$query"', ({ query, input }) => {
    expect(generateDesignSystem(input).query).toBe(query);
  });
});

describe.each(CASES)('parity: "$query"', ({ query, input }) => {
  const expected = truth[query];
  const actual = generateDesignSystem(input);

  it('has ground truth for this query', () => {
    expect(expected).toBeDefined();
  });

  it('resolves the same product category', () => {
    expect(actual.category).toBe(expected.category);
  });

  it('resolves the same palette, every slot', () => {
    expect(actual.colors).toEqual(expected.colors);
  });

  it('resolves the same font pairing', () => {
    expect(actual.typography).toEqual(expected.typography);
  });

  it('resolves the same landing pattern', () => {
    expect(actual.pattern).toEqual(expected.pattern);
  });

  it('carries the same anti-patterns, decision rules and severity', () => {
    expect(actual.anti_patterns).toBe(expected.anti_patterns);
    expect(actual.decision_rules).toEqual(expected.decision_rules);
    expect(actual.severity).toBe(expected.severity);
  });

  it('derives the same project name', () => {
    expect(actual.project_name).toBe(expected.project_name);
  });

  it('differs from Python only where the divergence list allows', () => {
    expectParity(query, expected);
  });
});

describe('style priority corrections', () => {
  const styleNames = new Set(
    (styles as Array<Record<string, string>>).map((s) => s['Style Category'].toLowerCase()),
  );

  it('every alias points at a style that actually exists', () => {
    for (const [from, to] of Object.entries(STYLE_PRIORITY_ALIASES)) {
      expect(styleNames.has(to.toLowerCase()), `${from} -> ${to} is not a real style`).toBe(true);
    }
  });

  it('no alias key is already a valid style name', () => {
    for (const from of Object.keys(STYLE_PRIORITY_ALIASES)) {
      expect(styleNames.has(from), `"${from}" needs no alias`).toBe(false);
    }
  });

  it('the documented unresolved priorities really are absent from the dataset', () => {
    for (const p of UNRESOLVED_STYLE_PRIORITIES) {
      expect(styleNames.has(p.toLowerCase()), `"${p}" exists after all`).toBe(false);
    }
  });

  it('no longer sends fintech to the oversized editorial style', () => {
    const r = generateDesignSystem({ productType: 'fintech', keywords: ['mobile', 'trustworthy'] });
    expect(r.style.name).not.toBe('Exaggerated Minimalism');
  });

  it('no longer leaks mobile-only variants into queries with no mobile signal', () => {
    for (const q of ['education kids playful', 'kids learning colorful', '24/7 support portal']) {
      const words = q.split(' ');
      const r = generateDesignSystem({ productType: words[0], keywords: words.slice(1) });
      expect(r.style.name, `"${q}" still got a mobile variant`).not.toMatch(/\(Mobile\)/);
    }
  });

  it('resolves an aliased priority to the corrected style and says so', () => {
    const r = generateDesignSystem({ productType: 'analytics', keywords: ['dashboard'] });
    expect(r.style.name).toBe('Data-Dense Dashboard');
    expect(r.reasoning.style.why).toContain('not a style in the dataset');
  });
});

describe('tokens derived from the style', () => {
  it('gives a zero-radius style zero-radius components', () => {
    const r = generateDesignSystem({ productType: 'creative', keywords: ['agency', 'brutalism'] });
    if (r.style.name === 'Brutalism') {
      expect(r.components.button.radius).toBe('0px');
      expect(r.radius.every((t) => t.value === '0px')).toBe(true);
    }
  });

  it('reads the radius from the matched style when it declares one', () => {
    const r = generateDesignSystem({ productType: 'general', keywords: ['purpose', 'app', 'clean'] });
    // Flat Design declares --border-radius: 2px.
    expect(r.style.name).toBe('Flat Design');
    expect(r.components.button.radius).toBe('2px');
    expect(r.reasoning.components.evidence?.radius).toBe('style');
  });

  it('falls back to the ported defaults when the style declares nothing', () => {
    const r = generateDesignSystem({ productType: 'saas', keywords: ['dashboard', 'dark'] });
    if (r.reasoning.components.evidence?.radius === 'default') {
      expect(r.components.button.radius).toBe('8px');
      expect(r.components.modal.radius).toBe('16px');
    }
  });

  it('labels the provenance of every derived scale', () => {
    const r = generateDesignSystem({ productType: 'general', keywords: ['purpose', 'app'] });
    expect(['style', 'default']).toContain(r.reasoning.spacing.evidence?.source);
    expect(['style', 'default']).toContain(r.motion.source);
  });

  it('keeps the spacing ramp seven steps whatever the base', () => {
    for (const q of ['general purpose app', 'analytics dashboard', 'creative agency brutalism']) {
      const words = q.split(' ');
      const r = generateDesignSystem({ productType: words[0], keywords: words.slice(1) });
      expect(r.spacing, q).toHaveLength(7);
      expect(r.radius, q).toHaveLength(3);
    }
  });
});

describe('reasoning output', () => {
  const fintech = CASES.find((c) => c.query === 'fintech mobile trustworthy')!;
  const result = generateDesignSystem(fintech.input);

  it('explains every major decision', () => {
    const keys = [
      'category', 'pattern', 'style', 'colors', 'typography',
      'effects', 'spacing', 'components', 'antiPatterns',
    ] as const;
    for (const key of keys) {
      const r = result.reasoning[key];
      expect(r.why.length, `${key} has no why`).toBeGreaterThan(20);
      expect(r.source.length, `${key} has no source`).toBeGreaterThan(0);
      expect(r.decision.length, `${key} has no decision`).toBeGreaterThan(0);
    }
  });

  it('cites the reasoning row that drove the category', () => {
    expect(result.reasoning.category.decision).toBe('Fintech/Crypto');
    expect(result.reasoning.category.why).toContain('Fintech/Crypto');
  });

  it('names the priority the style was chosen for', () => {
    expect(result.reasoning.style.evidence?.priority).toContain('Minimalism');
    expect(result.reasoning.style.why.length).toBeGreaterThan(40);
  });
});

describe('output shape', () => {
  const result = generateDesignSystem({
    productType: 'saas',
    industry: 'healthcare',
    keywords: ['calm'],
    region: 'Nigeria',
  });

  it('echoes the input, region included', () => {
    expect(result.input.region).toBe('Nigeria');
  });

  it('leaves region out of the search query for now', () => {
    // Deliberate: feeding region into BM25 would shift scores away from Python parity.
    expect(result.query).toBe('saas healthcare calm');
  });

  it('leaves id unset for a future save feature to fill', () => {
    expect(result.id).toBeUndefined();
    expect('id' in result).toBe(false);
  });

  it('ships the spacing, radius, shadow and component scales', () => {
    expect(result.spacing).toHaveLength(7);
    expect(result.radius).toHaveLength(3);
    expect(result.shadows).toHaveLength(4);
    expect(result.components.button.radius).toMatch(/^\d+px$/);
  });

  it('is pure: the same input twice gives identical output', () => {
    const a = generateDesignSystem({ productType: 'fintech', keywords: ['mobile'] });
    const b = generateDesignSystem({ productType: 'fintech', keywords: ['mobile'] });
    expect(a).toEqual(b);
  });
});
