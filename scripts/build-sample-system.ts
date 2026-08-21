/**
 * Precomputes the marketing sample system.
 *
 *   npx tsx scripts/build-sample-system.ts
 *
 * The landing page shows one real generated system — a live hero preview, a colour row, a
 * genuine "why" string. It got those by calling `generateDesignSystem()` at module scope,
 * which is honest but expensive: importing the engine pulls the entire ~480 kB dataset into
 * whatever chunk the home page lands in, so every visitor downloads all 161 product types
 * and 84 styles to render one example.
 *
 * Running the real engine here at build time and committing the result keeps the page just
 * as honest — it is still genuine engine output, not hand-written values — while shipping
 * ~8 kB instead of ~480 kB.
 *
 * Re-run this whenever the engine's output changes; `engineVersion` in the file records what
 * produced it, and a test fails if it drifts from what the current engine would generate.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateDesignSystem } from '../src/engine';
import { ENGINE_VERSION } from '../src/engine/version';

/** The query behind the landing page. Kept here so the test can regenerate and compare. */
export const SAMPLE_INPUT = {
  productType: 'fintech mobile app',
  keywords: ['trustworthy', 'modern', 'minimal'],
};

const system = generateDesignSystem(SAMPLE_INPUT);
const payload = { engineVersion: ENGINE_VERSION, input: SAMPLE_INPUT, system };

const out = join(import.meta.dirname, '..', 'src', 'data', 'sample-system.json');
writeFileSync(out, `${JSON.stringify(payload, null, 1)}\n`, 'utf-8');

const size = JSON.stringify(payload).length;
console.log(`\nwrote ${out}`);
console.log(`  ${system.category} · ${system.style.name}`);
console.log(`  ${(size / 1024).toFixed(1)} kB, engine ${ENGINE_VERSION}\n`);
