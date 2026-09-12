/**
 * Shared parity checking.
 *
 * The engine is no longer a byte-identical port: the style matcher was deliberately fixed,
 * and the product matcher now requires a category to be corroborated by the row's own name
 * or keywords (PORTING-NOTES judgment calls 2 and 7). Everything else must still match the
 * Python exactly, so parity is asserted field by field against the reviewed divergence list.
 *
 * A divergence must be RECORDED to pass, and recorded with the Python's value too — so a
 * matcher change that moves a query nobody reviewed fails the suite instead of quietly
 * rewriting the baseline, and a stale record fails once the Python dump is recaptured.
 *
 * `key_effects` is derived from the selected style, so it moves with it and is checked the
 * same way.
 */

import { expect } from 'vitest';
import { generateDesignSystem } from '../designSystem';
import type { PythonParityOutput } from '../types';
import divergence from './fixtures/intended-divergence.json';

interface Divergence<T = string> {
  python: T;
  ts: T;
  why: string;
}

/**
 * Style divergence sits at the top level (sixteen queries, the original matcher fix); any
 * other field that diverges is recorded under its own name, as `category` is here.
 */
type Record_ = Divergence & Partial<Record<(typeof UNCHANGED_FIELDS)[number], Divergence<unknown>>>;

const INTENDED = divergence as Record<string, Record_>;

/** Fields that must still match the Python engine exactly, for every query. */
export const UNCHANGED_FIELDS = [
  'project_name',
  'category',
  'pattern',
  'colors',
  'typography',
  'anti_patterns',
  'decision_rules',
  'severity',
] as const;

export function fromQuery(query: string) {
  const words = query.split(/\s+/).filter(Boolean);
  return { productType: words[0] ?? '', keywords: words.slice(1) };
}

/**
 * Assert one query against its captured Python output.
 *
 * Style is allowed to differ only where `intended-divergence.json` says so, and then only
 * to the exact value recorded there — so an unreviewed change in the matcher fails the
 * suite rather than quietly rewriting the baseline.
 */
export function expectParity(query: string, expected: PythonParityOutput): void {
  const actual = generateDesignSystem(fromQuery(query));

  const intended = INTENDED[query];

  for (const field of UNCHANGED_FIELDS) {
    const recorded = intended?.[field];
    if (recorded) {
      expect(recorded.python, `${field} divergence baseline stale for "${query}"`).toEqual(expected[field]);
      expect(actual[field], `unexpected ${field} for "${query}"`).toEqual(recorded.ts);
    } else {
      expect(actual[field], `${field} changed for "${query}" without being recorded as intended`).toEqual(
        expected[field],
      );
    }
  }

  if (intended) {
    expect(intended.python, `divergence baseline stale for "${query}"`).toBe(expected.style.name);
    expect(actual.style.name, `unexpected style for "${query}"`).toBe(intended.ts);
  } else {
    expect(actual.style, `style changed for "${query}" without being recorded as intended`)
      .toEqual(expected.style);
    expect(actual.key_effects, `key_effects changed for "${query}"`).toBe(expected.key_effects);
  }
}

/** True when this query is on the reviewed divergence list. */
export function isIntendedDivergence(query: string): boolean {
  return query in INTENDED;
}
