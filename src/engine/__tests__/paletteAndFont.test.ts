import { describe, expect, it } from 'vitest';
import { generateDesignSystem } from '../designSystem';
import { assessMatchQuality } from '../matchQuality';
import { CSV_CONFIG, rowNamed, search } from '../search';

/**
 * How the palette and the font pairing are chosen.
 *
 * Both were reported from the live app on one query — "A savings app for market traders in
 * Lagos." — which produced the **Educational App** palette (playful indigo, matched on the
 * word "app") and **Noto Sans SC**, because "market" appears in Chinese Simplified's Best For:
 * "mainland China market". Meanwhile the reasoning printed beside them promised "Calm blue +
 * success green + alert red" and a "Modern + Clear hierarchy" tone.
 *
 * See PORTING-NOTES judgment call 8 for the measurement behind both rules.
 */

const LAGOS = { productType: 'A savings app for market traders in Lagos.', keywords: [] };

describe('the palette follows the product category', () => {
  it('uses the colours row named after the category', () => {
    const system = generateDesignSystem(LAGOS);
    const row = rowNamed('color', 'Personal Finance Tracker')!;
    expect(system.category).toBe('Personal Finance Tracker');
    expect(system.colors.primary).toBe(row['Primary']);
    expect(system.colors.background).toBe(row['Background']);
    expect(system.colors.notes).toBe('Trust blue + profit green on dark');
  });

  it('is the palette the reasoning row promises, not one matched on a stray word', () => {
    const system = generateDesignSystem(LAGOS);
    // The mood the category declares, and the palette now delivering it.
    expect(system.reasoning.colors.why).toContain('Calm blue + success green');
    expect(system.reasoning.colors.why).toContain('Personal Finance Tracker');
    // Educational App was the old answer, matched on "app".
    expect(system.reasoning.colors.why).not.toContain('Educational App');
  });

  it('reports being read from the category rather than scored', () => {
    const system = generateDesignSystem(LAGOS);
    expect(system.provenance.colors.path).toBe('category');
    expect(system.provenance.colors.score).toBeUndefined();
    expect(assessMatchQuality(system).colors.basis).toContain('exact product category');
  });

  it('falls back to search when the category has no palette of its own', () => {
    // Nothing matches, so the category is General — which has no row in colours.csv.
    const system = generateDesignSystem({ productType: 'zzzz', keywords: [] });
    expect(system.category).toBe('General');
    expect(system.provenance.colors.path).not.toBe('category');
  });

  it('has a palette for every product type, so the fallback stays the exception', () => {
    const missing = CSV_CONFIG.product.data
      .map((row) => String(row['Product Type']))
      .filter((type) => !rowNamed('color', type));
    expect(missing).toEqual([]);
  });
});

describe('a font pairing built for another script needs to be asked for', () => {
  it('does not set a Nigerian savings app in Simplified Chinese', () => {
    const system = generateDesignSystem(LAGOS);
    expect(system.typography.heading).toBe('Inter');
    expect(system.typography.body).toBe('Inter');
  });

  it('says what it refused and why, instead of only "no pairing matched"', () => {
    const system = generateDesignSystem(LAGOS);
    expect(system.provenance.typography.excluded).toContain('Chinese Simplified');
    expect(system.reasoning.typography.why).toContain('another script');
    const quality = assessMatchQuality(system).typography;
    expect(quality.isFallback).toBe(true);
    expect(quality.basis).toContain('incidental word');
  });

  it('still reaches a script pairing when the query asks for that script', () => {
    expect(search('chinese simplified site', 'typography', 1).results[0]?.['Font Pairing Name']).toBe(
      'Chinese Simplified',
    );
    expect(search('japanese app', 'typography', 1).results[0]?.['Font Pairing Name']).toBe('Japanese Elegant');
  });

  it('leaves a prose match that is genuinely about the audience alone', () => {
    // "insurance" sits in Financial Trust's Best For — banks, finance, insurance. That is the
    // pairing's audience, not a passing mention, and the rule must not touch it.
    expect(search('insurance claims clarity', 'typography', 1).results[0]?.['Font Pairing Name']).toBe(
      'Financial Trust',
    );
  });

  it('does not let a function word pick a pairing', () => {
    // "the and but" selected a Web3 crypto pairing; three stopwords should select nothing.
    expect(search('the and but', 'typography', 1).count).toBe(0);
  });
});

describe('a hyphenated word also asks for its joined form', () => {
  it('reads fin-tech as fintech', () => {
    // `fin` + `tech` matched Space Tech / Aerospace on "tech"; the dataset spells it fintech.
    expect(generateDesignSystem({ productType: 'fin-tech', keywords: [] }).category).toBe('Fintech/Crypto');
  });

  it('adds the joined form without removing the split one', () => {
    // "e-commerce b2b" still reaches E-commerce, matched on the split tokens as before.
    expect(search('e-commerce b2b', 'product', 1).results[0]?.['Product Type']).toBe('E-commerce');
  });
});
