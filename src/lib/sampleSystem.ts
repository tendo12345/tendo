import type { DesignSystemOutput } from '../engine/types';
import sample from '../data/sample-system.json';

/**
 * The one real, engine-generated system used across the marketing pages (hero preview,
 * how-it-works, what-you-get).
 *
 * Still genuine engine output — every number and colour on the landing page is what
 * `generateDesignSystem()` actually produces — but computed at build time by
 * `scripts/build-sample-system.ts` rather than in the browser.
 *
 * The reason is size, not speed. Calling the engine here imported the entire ~480 kB dataset
 * into the landing page's chunk, so every first-time visitor downloaded all 161 product types
 * to render one example they did not ask for. This is ~8 kB.
 *
 * Note the type-only import above: it must stay `import type`, or the engine is pulled back
 * into this chunk and the saving disappears. `sampleSystem.test.ts` regenerates this file's
 * contents with the live engine and fails if they drift apart.
 */
export const SAMPLE_SYSTEM = sample.system as unknown as DesignSystemOutput;

/** The query that produced it, so the page can show what was actually asked. */
export const SAMPLE_INPUT = sample.input;

/** Engine version at the time it was generated. */
export const SAMPLE_ENGINE_VERSION = sample.engineVersion;
