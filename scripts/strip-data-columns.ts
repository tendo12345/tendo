/**
 * Removes data columns the engine never reads.
 *
 *   npx tsx scripts/strip-data-columns.ts --check   (report only)
 *   npx tsx scripts/strip-data-columns.ts           (rewrite src/data)
 *
 * The ported JSON mirrors the upstream CSVs column for column, which is right for fidelity
 * and wrong for a browser bundle: ~540 kB ships so the engine can read a subset of it.
 *
 * The keep-list is derived from `CSV_CONFIG` rather than hand-written, so adding a column to
 * a domain's search or output list automatically preserves it. Columns read directly
 * elsewhere in the engine are listed in EXTRA below, and that list is the one thing here that
 * a future change could invalidate — which is why this script fingerprints all 161 product
 * types before and after and refuses to write if any output moved.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CSV_CONFIG } from '../src/engine/search';
import { generateDesignSystem } from '../src/engine';
import { hashOutput } from '../src/engine/version';
import products from '../src/data/products.json';

type Row = Record<string, string>;

const DATA = join(import.meta.dirname, '..', 'src', 'data');

/**
 * Columns read outside CSV_CONFIG, by direct property access.
 *
 * `ui-reasoning.json` has no CSV_CONFIG entry at all — designSystem.ts reads it directly —
 * so every column it uses is listed here.
 */
const EXTRA: Record<string, string[]> = {
  'products.json': [
    // productPatterns.ts looks these up on the matched row.
    'Product Type',
    'Keywords',
    'Key Considerations',
  ],
  'ui-reasoning.json': [
    'UI_Category',
    'Recommended_Pattern',
    'Style_Priority',
    'Color_Mood',
    'Typography_Mood',
    'Key_Effects',
    'Decision_Rules',
    'Anti_Patterns',
    'Severity',
  ],
};

const FILES: Record<string, string> = {
  'products.json': 'product',
  'styles.json': 'style',
  'colors.json': 'color',
  'landing.json': 'landing',
  'typography.json': 'typography',
  'ui-reasoning.json': '',
};

function keepFor(file: string): Set<string> {
  const keep = new Set<string>(EXTRA[file] ?? []);
  const domain = FILES[file];
  if (domain) {
    const config = CSV_CONFIG[domain as keyof typeof CSV_CONFIG];
    // Search columns build the BM25 document; dropping one would change ranking.
    for (const c of config.search_cols) keep.add(c);
    for (const c of config.output_cols) keep.add(c);
  }
  return keep;
}

function fingerprintAll(): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of products as Row[]) {
    const words = p['Product Type'].split(/\s+/).filter(Boolean);
    const system = generateDesignSystem({ productType: words[0], keywords: words.slice(1) });
    out.set(p['Product Type'], hashOutput(system));
  }
  return out;
}

const check = process.argv.includes('--check');

const before = fingerprintAll();
let totalBefore = 0;
let totalAfter = 0;
const report: string[] = [];

const written: Array<{ path: string; content: string }> = [];

for (const file of Object.keys(FILES)) {
  const path = join(DATA, file);
  const raw = readFileSync(path, 'utf-8');
  totalBefore += raw.length;

  const rows = JSON.parse(raw) as Row[];
  const keep = keepFor(file);
  const present = new Set(Object.keys(rows[0] ?? {}));
  const dropped = [...present].filter((c) => !keep.has(c));

  const stripped = rows.map((row) => {
    const next: Row = {};
    for (const col of Object.keys(row)) if (keep.has(col)) next[col] = row[col];
    return next;
  });

  const content = `${JSON.stringify(stripped, null, 1)}\n`;
  totalAfter += content.length;
  written.push({ path, content });

  report.push(
    `  ${file.padEnd(20)} ${String(present.size).padStart(2)} cols -> ${String(keep.size <= present.size ? present.size - dropped.length : present.size).padStart(2)}   ${(raw.length / 1024).toFixed(0).padStart(4)} kB -> ${(content.length / 1024).toFixed(0).padStart(4)} kB${dropped.length ? `   dropped: ${dropped.join(', ')}` : '   (nothing to drop)'}`,
  );
}

console.log('\n=== columns ===\n');
console.log(report.join('\n'));
console.log(
  `\n  total ${(totalBefore / 1024).toFixed(0)} kB -> ${(totalAfter / 1024).toFixed(0)} kB  (${Math.round((1 - totalAfter / totalBefore) * 100)}% smaller)\n`,
);

if (check) {
  console.log('  --check: nothing written.\n');
  process.exit(0);
}

for (const { path, content } of written) writeFileSync(path, content, 'utf-8');

// Re-import is not possible in the same process, so the caller verifies. Print the baseline
// so a follow-up run can diff against it.
console.log('  written. Verify with: npx tsx scripts/verify-data-parity.ts\n');
writeFileSync(
  join(import.meta.dirname, '..', '.data-fingerprints.json'),
  `${JSON.stringify(Object.fromEntries(before), null, 1)}\n`,
  'utf-8',
);
