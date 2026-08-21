/**
 * Guards the precomputed landing-page sample.
 *
 * `src/data/sample-system.json` is committed engine output, shipped so the marketing pages do
 * not have to import the whole dataset. Committed output can go stale — the engine changes,
 * the file does not, and the landing page starts advertising a system the tool no longer
 * produces. That is exactly the kind of quiet dishonesty this product exists to avoid, so it
 * is checked rather than trusted.
 *
 * When this fails: run `npm run build:sample` and commit the result.
 */

import { describe, expect, it } from 'vitest';
import { generateDesignSystem } from '../engine';
import { ENGINE_VERSION, hashOutput } from '../engine/version';
import { SAMPLE_ENGINE_VERSION, SAMPLE_INPUT, SAMPLE_SYSTEM } from './sampleSystem';

describe('precomputed sample system', () => {
  it('matches what the current engine generates for the same input', () => {
    const live = generateDesignSystem(SAMPLE_INPUT);
    expect(
      hashOutput(SAMPLE_SYSTEM),
      'The committed sample has drifted from the engine. Run: npm run build:sample',
    ).toBe(hashOutput(live));
  });

  it('records the engine version that produced it', () => {
    expect(
      SAMPLE_ENGINE_VERSION,
      'Sample was built by an older engine. Run: npm run build:sample',
    ).toBe(ENGINE_VERSION);
  });

  it('is a complete system, not a trimmed fixture', () => {
    // The marketing pages read reasoning and tokens off it, so a partial object would render
    // blanks rather than throw.
    expect(SAMPLE_SYSTEM.colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(SAMPLE_SYSTEM.typography.heading.length).toBeGreaterThan(0);
    expect(SAMPLE_SYSTEM.reasoning.colors.why.length).toBeGreaterThan(20);
    expect(SAMPLE_SYSTEM.spacing).toHaveLength(7);
    expect(SAMPLE_SYSTEM.ground.css).toContain('gradient');
  });
});
