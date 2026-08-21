/**
 * Regenerates `fixtures/intended-divergence.json`: every query where the engine now picks
 * a different style from the Python source, with both values.
 *
 *   npx tsx scripts/capture-divergence.ts
 *
 * Review the diff before committing. A new entry appearing here means the matcher changed
 * behaviour on a query that used to agree with the Python.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateDesignSystem } from '../src/engine';
import type { PythonParityOutput } from '../src/engine';

const FIXTURES = join(import.meta.dirname, '..', 'src', 'engine', '__tests__', 'fixtures');

function fromQuery(query: string) {
  const words = query.split(/\s+/).filter(Boolean);
  return { productType: words[0] ?? '', keywords: words.slice(1) };
}

const out: Record<string, { python: string; ts: string; why: string }> = {};

for (const file of readdirSync(FIXTURES).filter((f) => f.startsWith('python-') && f.endsWith('.json'))) {
  const dump = JSON.parse(readFileSync(join(FIXTURES, file), 'utf-8')) as Record<
    string,
    PythonParityOutput
  >;
  for (const [query, expected] of Object.entries(dump)) {
    if ((expected as unknown as Record<string, unknown>).__error__) continue;
    const actual = generateDesignSystem(fromQuery(query));
    if (actual.style.name !== expected.style.name) {
      out[query] = {
        python: expected.style.name,
        ts: actual.style.name,
        why: actual.reasoning.style.why,
      };
    }
  }
}

const path = join(FIXTURES, 'intended-divergence.json');
writeFileSync(path, `${JSON.stringify(out, null, 1)}\n`, 'utf-8');
console.log(`\n${Object.keys(out).length} queries diverge from the Python style choice:\n`);
for (const [q, v] of Object.entries(out)) {
  console.log(`  ${q.padEnd(34)} ${v.python}  ->  ${v.ts}`);
}
console.log(`\nwritten to ${path}\n`);
