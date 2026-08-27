import coverage from '../data/coverage.json';

/**
 * What the engine actually knows, precomputed at build time.
 *
 * These are counted from the real datasets by `scripts/build-coverage.ts`, not typed out, and
 * `coverage.test.ts` fails if the data changes without this being regenerated. That matters
 * more than it sounds for a product whose whole claim is that it does not invent numbers: a
 * hardcoded "160+ product types" on the landing page would be a made-up statistic about the
 * one thing this tool is supposed to be honest about.
 *
 * Imported here rather than read from src/data at runtime so the landing page does not pull
 * the ~480 kB dataset into its chunk. See the note in vite.config.ts.
 *
 * When this is wrong: run `npm run build:coverage` and commit the result.
 */
export interface Coverage {
  productCount: number;
  styleCount: number;
  paletteCount: number;
  pairingCount: number;
  sampleProducts: string[];
}

export const COVERAGE: Coverage = coverage;
