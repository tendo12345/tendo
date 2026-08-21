/**
 * Shared parity checking.
 *
 * The engine is no longer a byte-identical port: the style matcher was deliberately fixed
 * (see PORTING-NOTES.md). Everything else must still match the Python exactly, so parity
 * is asserted field by field, with `style` and `key_effects` checked against the reviewed
 * divergence list instead.
 *
 * `key_effects` is derived from the selected style, so it moves with it and is checked the
 * same way.
 */

import { expect } from 'vitest';
import { generateDesignSystem } from '../designSystem';
import type { PythonParityOutput } from '../types';
import divergence from './fixtures/intended-divergence.json';

const INTENDED = divergence as Record<string, { python: string; ts: string; why: string }>;

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

  for (const field of UNCHANGED_FIELDS) {
    expect(actual[field], `${field} changed for "${query}"`).toEqual(expected[field]);
  }

  const intended = INTENDED[query];
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
