/**
 * Reports every place the engine now deliberately differs from the Python source.
 *
 *   npx tsx scripts/divergence.ts
 *
 * Runs all 161 product types plus the captured fixture queries, and classifies each
 * difference. Anything that shows up here should be an intended fix; anything unexplained
 * is a regression.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { generateDesignSystem } from '../src/engine';
import type { PythonParityOutput } from '../src/engine';
import products from '../src/data/products.json';

type Row = Record<string, string>;

const FIXTURES = join(import.meta.dirname, '..', 'src', 'engine', '__tests__', 'fixtures');

function fromQuery(query: string) {
  const words = query.split(/\s+/).filter(Boolean);
  return { productType: words[0] ?? '', keywords: words.slice(1) };
}

// ---- 1. Style selection changes across every product type -------------------------

let changed = 0;
const byKind = new Map<string, number>();
const samples: string[] = [];

for (const p of products as Row[]) {
  const query = p['Product Type'];
  const r = generateDesignSystem(fromQuery(query));
  const why = r.reasoning.style.why;

  const aliased = why.includes('is not a style in the dataset');
  const exact = why.includes('is that style by name');
  const partial = why.includes('closest partial match');

  const kind = aliased ? 'alias-corrected' : exact ? 'exact' : partial ? 'partial (data gap)' : 'scored/top';
  byKind.set(kind, (byKind.get(kind) ?? 0) + 1);

  if (aliased) {
    changed++;
    if (samples.length < 8) samples.push(`  ${query.padEnd(32)} -> ${r.style.name}`);
  }
}

console.log('\n=== style selection, across all 161 product types ===\n');
for (const [kind, n] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${kind.padEnd(20)} ${n}`);
}
console.log(`\n  alias corrections applied: ${changed}`);
console.log(samples.join('\n'));

// ---- 2. Token derivation coverage -------------------------------------------------

let styleRadius = 0, styleSpacing = 0, styleMotion = 0;
for (const p of products as Row[]) {
  const r = generateDesignSystem(fromQuery(p['Product Type']));
  if (r.reasoning.components.evidence?.radius === 'style') styleRadius++;
  if (r.reasoning.spacing.evidence?.source === 'style') styleSpacing++;
  if (r.motion.source === 'style') styleMotion++;
}

console.log('\n=== token derivation, across all 161 product types ===\n');
console.log(`  radius from the matched style  : ${styleRadius} (rest use the ported default)`);
console.log(`  spacing from the matched style : ${styleSpacing}`);
console.log(`  motion from the matched style  : ${styleMotion}`);

// ---- 3. Field-level diff against every captured Python fixture ---------------------

const fieldChanges = new Map<string, number>();
let compared = 0;

// Only the captured Python dumps. `intended-divergence.json` also lives here but holds a
// different shape, and comparing against it would report every field as changed.
for (const file of readdirSync(FIXTURES).filter((f) => f.startsWith('python-') && f.endsWith('.json'))) {
  const dump = JSON.parse(readFileSync(join(FIXTURES, file), 'utf-8')) as Record<
    string,
    PythonParityOutput
  >;
  for (const [query, expected] of Object.entries(dump)) {
    if ((expected as unknown as Row).__error__) continue;
    compared++;
    const actual = generateDesignSystem(fromQuery(query));
    const parity: PythonParityOutput = {
      project_name: actual.project_name,
      category: actual.category,
      pattern: actual.pattern,
      style: actual.style,
      colors: actual.colors,
      typography: actual.typography,
      key_effects: actual.key_effects,
      anti_patterns: actual.anti_patterns,
      decision_rules: actual.decision_rules,
      severity: actual.severity,
    };
    for (const key of Object.keys(parity) as Array<keyof PythonParityOutput>) {
      if (JSON.stringify(parity[key]) !== JSON.stringify(expected[key])) {
        fieldChanges.set(key, (fieldChanges.get(key) ?? 0) + 1);
      }
    }
  }
}

console.log(`\n=== diff vs captured Python output (${compared} queries) ===\n`);
if (fieldChanges.size === 0) {
  console.log('  no differences');
} else {
  for (const [field, n] of [...fieldChanges.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${field.padEnd(16)} differs on ${n}/${compared}`);
  }
}
console.log('');
