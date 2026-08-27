/**
 * Guards the precomputed coverage figures.
 *
 * `src/data/coverage.json` states, on the landing page, how much the engine knows. It is
 * committed so the marketing pages do not import the whole dataset — and committed numbers go
 * stale silently. A page advertising 161 product types for a dataset that now has 140 is
 * exactly the invented-statistic problem this product exists to avoid.
 *
 * Tests may import the real datasets freely; only the shipped landing chunk may not.
 *
 * When this fails: run `npm run build:coverage` and commit the result.
 */

import { describe, expect, it } from 'vitest';
import colors from '../data/colors.json';
import products from '../data/products.json';
import styles from '../data/styles.json';
import typography from '../data/typography.json';
import { COVERAGE } from './coverage';

function rowsOf(parsed: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
  const first = Object.values(parsed as Record<string, unknown>)[0];
  return (Array.isArray(first) ? first : []) as Array<Record<string, unknown>>;
}

describe('precomputed coverage', () => {
  it('counts match the datasets it claims to describe', () => {
    expect(COVERAGE.productCount).toBe(rowsOf(products).length);
    expect(COVERAGE.styleCount).toBe(rowsOf(styles).length);
    expect(COVERAGE.paletteCount).toBe(rowsOf(colors).length);
    expect(COVERAGE.pairingCount).toBe(rowsOf(typography).length);
  });

  it('every listed product name is a real row, not an illustrative example', () => {
    const real = new Set(
      rowsOf(products).map((row) => String(row['Product Type'] ?? '').trim()),
    );

    for (const name of COVERAGE.sampleProducts) {
      expect(real.has(name), `"${name}" is not a product type in products.json`).toBe(true);
    }
  });

  it('lists enough names to fill the scrolling column without visible repetition', () => {
    expect(COVERAGE.sampleProducts.length).toBeGreaterThanOrEqual(12);
  });

  it('has no duplicate names, which would read as a rendering bug', () => {
    expect(new Set(COVERAGE.sampleProducts).size).toBe(COVERAGE.sampleProducts.length);
  });
});
