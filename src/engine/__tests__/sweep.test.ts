/**
 * Bulk parity sweeps against the Python engine.
 *
 * These are holdout sets: the port was written against the four validation queries only,
 * then checked against these. They exist to catch a port that overfits its fixtures.
 *
 * Style differences are allowed only where `intended-divergence.json` records them, so the
 * deliberate matcher fix cannot hide an accidental change.
 *
 * Regenerate with scripts/capture-ground-truth.py (see PORTING-NOTES.md).
 */

import { describe, expect, it } from 'vitest';
import type { PythonParityOutput } from '../types';
import { expectParity } from './parityHelpers';
import adversarial from './fixtures/python-adversarial.json';
import holdout from './fixtures/python-holdout.json';

function suite(name: string, fixture: Record<string, PythonParityOutput>) {
  describe(name, () => {
    const queries = Object.keys(fixture);

    it('has a non-trivial fixture', () => {
      expect(queries.length).toBeGreaterThanOrEqual(30);
    });

    it('no query errored on the Python side', () => {
      for (const [query, expected] of Object.entries(fixture)) {
        expect((expected as unknown as Record<string, unknown>).__error__, query).toBeUndefined();
      }
    });

    it.each(queries)('matches Python for "%s"', (query) => {
      expectParity(query, fixture[query]);
    });
  });
}

suite('holdout sweep: ordinary queries', holdout as unknown as Record<string, PythonParityOutput>);
suite(
  'holdout sweep: adversarial queries',
  adversarial as unknown as Record<string, PythonParityOutput>,
);
