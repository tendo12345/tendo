/**
 * Pins how `industry` interacts with `productType`.
 *
 * This was written down as a defect — "industry is concatenated unweighted, so swapping it
 * with productType yields identical output" — and measuring it showed the description is
 * accurate but the conclusion was wrong. Across 55 product x industry combinations the
 * industry steers the product category in 49; in the other 6 the product type wins, and in
 * almost all of those the product type winning is the right answer.
 *
 * The tempting fix is to weight industry more heavily. These tests exist to stop that,
 * because it would trade six defensible results for six clearly worse ones: a fashion
 * designer's portfolio would resolve to a wardrobe planner, and an educator's portfolio to a
 * children's learning app.
 *
 * Two behaviours are pinned:
 *   - a generic product type lets the industry choose the category
 *   - a product type that names a real archetype beats the industry
 * A change that breaks either is a change to how matching works, not a tuning tweak.
 */

import { describe, expect, it } from 'vitest';
import { generateDesignSystem } from '../designSystem';
import { hashOutput } from '../version';

describe('industry steers a generic product type', () => {
  it.each([
    ['mobile app', 'Fintech', 'Fintech/Crypto'],
    ['mobile app', 'Healthcare', 'Healthcare App'],
    ['mobile app', 'Education', 'Educational App'],
    ['mobile app', 'Web3', 'NFT/Web3 Platform'],
    ['mobile app', 'Food', 'Restaurant/Food Service'],
    ['mobile app', 'Real Estate', 'Real Estate/Property'],
  ])('"%s" + "%s" resolves to %s', (productType, industry, expected) => {
    expect(generateDesignSystem({ productType, industry, keywords: [] }).category).toBe(expected);
  });

  it('changes the result versus omitting the industry', () => {
    const withIndustry = generateDesignSystem({ productType: 'mobile app', industry: 'Healthcare', keywords: [] });
    const without = generateDesignSystem({ productType: 'mobile app', keywords: [] });
    expect(hashOutput(withIndustry)).not.toBe(hashOutput(without));
  });
});

describe('a specific product type outranks the industry', () => {
  /*
    These are the cases the "unweighted industry" note called broken. They are not: the
    product type names a real archetype and should win. Weighting industry higher would
    replace each of these with the wrong answer, shown alongside.
  */
  it.each([
    ['portfolio', 'Fashion', 'Portfolio/Personal', 'Wardrobe & Outfit Planner'],
    ['portfolio', 'Education', 'Portfolio/Personal', 'Educational App'],
    ['dashboard', 'Technology', 'Analytics Dashboard', 'a generic technology match'],
  ])('"%s" + "%s" stays %s rather than becoming %s', (productType, industry, expected) => {
    expect(generateDesignSystem({ productType, industry, keywords: [] }).category).toBe(expected);
  });
});

describe('the field order carries no meaning', () => {
  it('produces the same system when product type and industry are swapped', () => {
    // BM25 scores a bag of words, so "mobile app" + "Fintech" and "Fintech" + "mobile app"
    // describe the same thing and resolve the same way. That is a property of the matching
    // model, not an oversight — the two fields exist to prompt the user for more signal,
    // not to be weighted differently.
    const a = generateDesignSystem({ productType: 'mobile app', industry: 'Fintech', keywords: [] });
    const b = generateDesignSystem({ productType: 'Fintech', industry: 'mobile app', keywords: [] });
    expect(hashOutput(a)).toBe(hashOutput(b));
  });

  it('treats an industry as equivalent to the same word as a keyword', () => {
    const asIndustry = generateDesignSystem({ productType: 'mobile app', industry: 'Healthcare', keywords: [] });
    const asKeyword = generateDesignSystem({ productType: 'mobile app', keywords: ['Healthcare'] });
    expect(hashOutput(asIndustry)).toBe(hashOutput(asKeyword));
  });
});
