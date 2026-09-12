/**
 * Pins the engine's output so selection cannot change without someone noticing.
 *
 * Saved systems store an input and rebuild on open, which is only safe while drift is
 * *detectable*. Detection depends on `ENGINE_VERSION` being bumped whenever output changes —
 * and nothing enforces that by itself. Without this file, changing the matcher and forgetting
 * the bump would silently regenerate everyone's saved systems into something else, with no
 * warning shown anywhere.
 *
 * When one of these fails, the question is which of two things happened:
 *
 *   - an intended change to selection → update the hash here AND bump ENGINE_VERSION
 *   - an accident → fix the code
 *
 * Never update a hash without bumping the version. That is the failure this guards against.
 */

import { describe, expect, it } from 'vitest';
import { generateDesignSystem } from '../designSystem';
import { ENGINE_VERSION, hashOutput } from '../version';
import products from '../../data/products.json';

type Row = Record<string, string>;

/**
 * Fingerprints captured at ENGINE_VERSION 2026.08.20, and unchanged at 2026.09.12.
 *
 * The corroboration rule (PORTING-NOTES judgment call 7) moved output for other inputs — a
 * category can no longer be named by a word that appears only in a row's notes — but none of
 * the five queries below, so these hashes are the originals rather than a rebaseline.
 */
const PINNED: Record<string, string> = {
  'fintech mobile trustworthy': 'c679d12d',
  'saas dashboard dark': '245d4c5b',
  'portfolio minimal editorial': '5b85b67e',
  'ecommerce fashion luxury': 'ccea878a',
  'general purpose app clean': 'aeab919d',
};

function fromQuery(query: string) {
  const words = query.split(/\s+/).filter(Boolean);
  return { productType: words[0], keywords: words.slice(1) };
}

describe('engine version', () => {
  it('is a dated string that sorts chronologically', () => {
    expect(ENGINE_VERSION).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });

  it.each(Object.keys(PINNED))('output for "%s" matches its pinned fingerprint', (query) => {
    const actual = hashOutput(generateDesignSystem(fromQuery(query)));
    const pinned = PINNED[query];

    // Empty pin means "record it" — only valid on first run, and the assertion below still
    // catches it so a blank pin can never sit in the repo unnoticed.
    expect(
      pinned,
      `No fingerprint pinned for "${query}". Current value is ${actual} — paste it into PINNED.`,
    ).not.toBe('');
    expect(actual, `Selection changed for "${query}". If intended, bump ENGINE_VERSION and update this hash.`).toBe(pinned);
  });

  it('every product type still produces a fingerprint', () => {
    // A guard against a change that throws on some category rather than changing its output.
    for (const p of (products as Row[]).slice(0, 40)) {
      const w = p['Product Type'].split(/\s+/).filter(Boolean);
      const hash = hashOutput(generateDesignSystem({ productType: w[0], keywords: w.slice(1) }));
      expect(hash, p['Product Type']).toMatch(/^[0-9a-f]{8}$/);
    }
  });
});
