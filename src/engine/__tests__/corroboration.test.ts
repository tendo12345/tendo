import { describe, expect, it } from 'vitest';
import { generateDesignSystem } from '../designSystem';
import { CSV_CONFIG, search } from '../search';

/**
 * A category must be corroborated by the row's own name or keywords.
 *
 * Reported from the live app: "A savings app for market traders in Lagos." produced
 * **Agriculture/Farm Tech**. The cause was measurable rather than mysterious. Every row is
 * indexed as one bag of words across four columns, one of which is implementation prose, and
 * "market" occurs in exactly one row of 161 — inside Agriculture's Key Considerations
 * ("market prices"). One rare word in a short row scored 5.03, beating Personal Finance
 * Tracker's 3.93 for "savings", which is that row's actual keyword and the only occurrence of
 * the word in the dataset.
 *
 * Prose still ranks rows. It can no longer name one on its own. See PORTING-NOTES judgment
 * call 7 for the measurement behind the scope of this rule.
 */

describe('the reported query', () => {
  it('reads a savings app as finance, not farming', () => {
    const { category } = generateDesignSystem({ productType: 'A savings app for market traders in Lagos.', keywords: [] });
    expect(category).toBe('Personal Finance Tracker');
  });

  it('names the category from a term the row itself carries', () => {
    const { reasoning } = generateDesignSystem({ productType: 'A savings app for market traders in Lagos.', keywords: [] });
    // "savings" is in Personal Finance Tracker's Keywords — the row is about savings, rather
    // than mentioning the word in passing.
    expect(CSV_CONFIG.product.data.find((r) => r['Product Type'] === 'Personal Finance Tracker')?.Keywords).toContain(
      'savings',
    );
    expect(reasoning.category.decision).toBe('Personal Finance Tracker');
  });
});

describe('the rule itself', () => {
  it('demotes a row that matches only in prose when a named match exists', () => {
    // Both words occur in exactly one row each: "market" only in Agriculture's prose,
    // "savings" only in Personal Finance Tracker's keywords.
    expect(search('savings market', 'product', 1).results[0]?.['Product Type']).toBe('Personal Finance Tracker');
  });

  it('still answers when nothing is corroborated, rather than going blank', () => {
    // "market" names no row at all, so the original ranking stands and the prose hit wins.
    // Losing the answer entirely would be a worse result than a weak one.
    const onlyProse = search('market', 'product', 1);
    expect(onlyProse.results[0]?.['Product Type']).toBe('Agriculture/Farm Tech');
    expect(onlyProse.count).toBe(1);
  });

  it('leaves a query with no match at all reporting nothing', () => {
    expect(search('zzzz', 'product', 1).count).toBe(0);
    expect(generateDesignSystem({ productType: 'zzzz', keywords: [] }).category).toBe('General');
  });

  it('keeps ranking by score within the corroborated rows', () => {
    // An exact product name must still win over a row that merely shares a keyword.
    expect(search('dental practice', 'product', 1).results[0]?.['Product Type']).toBe('Dental Practice');
    expect(search('recipe cooking', 'product', 1).results[0]?.['Product Type']).toBe('Recipe & Cooking App');
  });
});

describe('scope', () => {
  /*
    Products only, and that is measured. Applied to all five domains the rule changed 18 picks
    across the 65 pinned queries and some were worse: the `fin-tech` palette fell from
    Fintech/Crypto to Pet Tech App, because "fin-tech" tokenises to `fin` + `tech` and `tech`
    names Pet Tech App while nothing in Fintech/Crypto matches `fin`. Style regressed too.
    These pin the domains that must keep the Python's behaviour, with the case that decided it.
  */
  it('applies to the product domain alone', () => {
    expect(CSV_CONFIG.product.identity_cols).toEqual(['Product Type', 'Keywords']);
    for (const domain of ['style', 'color', 'landing', 'typography'] as const) {
      expect(CSV_CONFIG[domain].identity_cols, `${domain} must keep the Python's behaviour`).toBeUndefined();
    }
  });

  it('keeps the fin-tech palette, the case that ruled out applying it to colours', () => {
    expect(search('fin-tech', 'color', 1).results[0]?.['Product Type']).toBe('Fintech/Crypto');
  });

  it('keeps crypto on a desktop style, the case that ruled out applying it to styles', () => {
    // Terminal CLI (Mobile) would win under corroboration — the mobile-variant crowding that
    // PORTING-NOTES judgment call 2 exists to prevent.
    expect(search('crypto', 'style', 1).results[0]?.['Style Category']).toBe('Cyberpunk UI');
  });
});
