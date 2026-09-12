/**
 * Regenerates `fixtures/intended-divergence.json`: every query where the engine's output
 * differs from the captured Python source, field by field, with both values and the engine's
 * own reason for its choice.
 *
 *   npx tsx scripts/capture-divergence.ts
 *
 * Review the diff before committing. A new entry appearing here means the matcher changed
 * behaviour on a query that used to agree with the Python — which may be a fix or a
 * regression, and this script cannot tell the difference. Never run it merely to turn a
 * failing parity test green.
 *
 * Two deliberate divergences exist today (PORTING-NOTES judgment calls 2 and 7): the style
 * matcher runs exact-match-first, and a product category must be corroborated by the row's
 * own name or keywords rather than by prose about it. A category divergence carries the
 * fields derived from the reasoning row with it — pattern, anti-patterns, decision rules,
 * severity — so those appear here too, attributed to the same cause.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateDesignSystem } from '../src/engine';
import { UNCHANGED_FIELDS, fromQuery } from '../src/engine/__tests__/parityHelpers';
import type { DesignSystemOutput, PythonParityOutput } from '../src/engine';

const FIXTURES = join(import.meta.dirname, '..', 'src', 'engine', '__tests__', 'fixtures');

interface Divergence<T = string> {
  python: T;
  ts: T;
  why: string;
}

type Entry = Divergence & Partial<Record<(typeof UNCHANGED_FIELDS)[number], Divergence<unknown>>>;

/** The engine's own stated reason for a field, where it keeps one. */
function why(actual: DesignSystemOutput, field: string): string {
  const reasoning = actual.reasoning as Record<string, { why?: string } | undefined>;
  const direct = reasoning[field]?.why;
  if (direct) return direct;
  // anti_patterns / decision_rules / severity all come off the reasoning row, which the
  // category chose.
  return `Carried by the category: ${reasoning.category?.why ?? 'reasoning row changed'}`;
}

const out: Record<string, Entry> = {};

for (const file of readdirSync(FIXTURES).filter((f) => f.startsWith('python-') && f.endsWith('.json'))) {
  const dump = JSON.parse(readFileSync(join(FIXTURES, file), 'utf-8')) as Record<string, PythonParityOutput>;
  for (const [query, expected] of Object.entries(dump)) {
    if ((expected as unknown as Record<string, unknown>).__error__) continue;
    const actual = generateDesignSystem(fromQuery(query));

    const styleDiverges = actual.style.name !== expected.style.name;
    const fields = UNCHANGED_FIELDS.filter(
      (f) => JSON.stringify(actual[f]) !== JSON.stringify(expected[f]),
    );
    if (!styleDiverges && fields.length === 0) continue;

    const entry: Entry = {
      python: expected.style.name,
      ts: actual.style.name,
      why: actual.reasoning.style.why,
    };
    for (const field of fields) {
      (entry as Record<string, unknown>)[field] = {
        python: expected[field],
        ts: actual[field],
        why: why(actual, field),
      };
    }
    out[query] = entry;
  }
}

const path = join(FIXTURES, 'intended-divergence.json');
writeFileSync(path, `${JSON.stringify(out, null, 1)}\n`, 'utf-8');

console.log(`\n${Object.keys(out).length} queries diverge from the Python:\n`);
for (const [q, v] of Object.entries(out)) {
  const extra = Object.keys(v).filter((k) => !['python', 'ts', 'why'].includes(k));
  const style = v.python === v.ts ? '' : `style: ${v.python} -> ${v.ts}`;
  console.log(`  ${q.padEnd(34)} ${style}${extra.length ? `  [also: ${extra.join(', ')}]` : ''}`);
}
console.log(`\nwritten to ${path}\n`);
