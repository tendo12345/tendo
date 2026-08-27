/**
 * Precomputes the landing page's coverage figures.
 *
 *   npx tsx scripts/build-coverage.ts
 *
 * The coverage card states how much the engine actually knows — product types, styles,
 * palettes, font pairings — and lists real product names. Reading those from the datasets at
 * runtime would work and would also drag all ~480 kB of them into the landing chunk, undoing
 * the reason `sample-system.json` exists at all.
 *
 * So the counts are taken from the real files here, at build time, and committed. They stay
 * true because they are derived rather than typed out, and `coverage.test.ts` fails if the
 * datasets change and this file does not.
 *
 * Re-run after any change to src/data.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA = join(process.cwd(), 'src', 'data');

function rowsOf(file: string): Array<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(readFileSync(join(DATA, file), 'utf8'));
  if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
  const first = Object.values(parsed as Record<string, unknown>)[0];
  return (Array.isArray(first) ? first : []) as Array<Record<string, unknown>>;
}

const products = rowsOf('products.json');
const styles = rowsOf('styles.json');
const colors = rowsOf('colors.json');
const typography = rowsOf('typography.json');

/*
  The names shown in the card's scrolling column.

  Sampled at an even stride across the file rather than taking the first N, so the list reads
  as the breadth of what the engine covers instead of whichever rows happen to sit at the top.
  The stride is deterministic, so this file does not churn on every rebuild.
*/
const SAMPLE_SIZE = 24;
const stride = Math.max(1, Math.floor(products.length / SAMPLE_SIZE));
const sampleProducts = Array.from({ length: SAMPLE_SIZE }, (_, i) => products[i * stride])
  .filter(Boolean)
  .map((row) => String(row['Product Type'] ?? '').trim())
  .filter(Boolean);

const coverage = {
  productCount: products.length,
  styleCount: styles.length,
  paletteCount: colors.length,
  pairingCount: typography.length,
  sampleProducts,
};

writeFileSync(join(DATA, 'coverage.json'), `${JSON.stringify(coverage, null, 2)}\n`, 'utf8');

console.log(
  `coverage.json — ${coverage.productCount} products, ${coverage.styleCount} styles, ` +
    `${coverage.paletteCount} palettes, ${coverage.pairingCount} pairings, ` +
    `${sampleProducts.length} sampled names`,
);
