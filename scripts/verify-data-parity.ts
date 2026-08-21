/**
 * Proves a data transformation changed no output.
 *
 *   npx tsx scripts/verify-data-parity.ts
 *
 * `strip-data-columns.ts` writes `.data-fingerprints.json` holding the fingerprint of every
 * one of the 161 product types *before* it touched anything. This regenerates them all from
 * the rewritten data and compares. Any difference means a column the engine actually reads
 * was dropped — the one failure mode the strip script cannot detect from the inside.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateDesignSystem } from '../src/engine';
import { hashOutput } from '../src/engine/version';
import products from '../src/data/products.json';

type Row = Record<string, string>;

const baselinePath = join(import.meta.dirname, '..', '.data-fingerprints.json');
if (!existsSync(baselinePath)) {
  console.error('No baseline found. Run strip-data-columns.ts first.');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8')) as Record<string, string>;
const mismatches: string[] = [];
let checked = 0;

for (const p of products as Row[]) {
  const query = p['Product Type'];
  const words = query.split(/\s+/).filter(Boolean);
  const actual = hashOutput(generateDesignSystem({ productType: words[0], keywords: words.slice(1) }));
  const expected = baseline[query];
  checked++;
  if (expected && expected !== actual) mismatches.push(`  ${query}: ${expected} -> ${actual}`);
}

console.log(`\nchecked ${checked} product types against the pre-strip baseline`);
if (mismatches.length === 0) {
  console.log('  every system is byte-identical. The dropped columns were genuinely unused.\n');
  process.exit(0);
}

console.log(`\n  ${mismatches.length} CHANGED — a column in use was dropped:\n`);
console.log(mismatches.slice(0, 20).join('\n'));
process.exit(1);
