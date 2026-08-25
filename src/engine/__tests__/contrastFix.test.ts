/**
 * The contrast checker's one promise: a suggested fix actually fixes it.
 *
 * `computeSuggestedFix` verifies its candidate before returning, and returns null when no
 * shade of the colour reaches the target — the UI then says so rather than offering a button
 * that would not help. That behaviour is correct today, but nothing enforced it: the check
 * lives inside a single `if`, and it depends on `adjustForContrast`, which has already been
 * wrong once (it picked its search direction from a lightness threshold, so a mid-tone ground
 * sent it toward white where it could never reach the target).
 *
 * A regression there would not throw or fail typecheck. It would quietly start offering
 * colours that still fail, in the one feature whose entire value is being right about
 * contrast. So the guarantee is asserted across real palettes rather than assumed.
 */

import { describe, expect, it } from 'vitest';
import { auditAccessibility, computeSuggestedFix } from '../accessibility';
import { contrastRatio } from '../color';
import { generateDesignSystem } from '../designSystem';
import products from '../../data/products.json';

type Row = Record<string, string>;

const SAMPLE = (products as Row[]).slice(0, 60).map((p) => {
  const w = p['Product Type'].split(/\s+/).filter(Boolean);
  return generateDesignSystem({ productType: w[0], keywords: w.slice(1) });
});

describe('suggested contrast fixes', () => {
  it('every offered fix reaches its required ratio', () => {
    let offered = 0;

    for (const output of SAMPLE) {
      for (const pair of auditAccessibility(output).contrastPairs) {
        if (!pair.suggestedFix) continue;
        offered++;
        const ratio = contrastRatio(pair.suggestedFix, pair.background);
        expect(
          ratio,
          `${output.category} / ${pair.label}: offered ${pair.suggestedFix} against ${pair.background}`,
        ).not.toBeNull();
        expect(
          ratio!,
          `${output.category} / ${pair.label}: ${pair.suggestedFix} gives ${ratio?.toFixed(2)}, needs ${pair.required}`,
        ).toBeGreaterThanOrEqual(pair.required);
      }
    }

    // Guards the assertion itself: if the sample stopped producing failures, the loop above
    // would pass while checking nothing.
    expect(offered, 'no fixes were exercised — this test proved nothing').toBeGreaterThan(20);
  });

  it('offers no fix for a pair that already passes', () => {
    for (const output of SAMPLE) {
      for (const pair of auditAccessibility(output).contrastPairs) {
        if (pair.status === 'pass') {
          expect(pair.suggestedFix, `${output.category} / ${pair.label}`).toBeNull();
        }
      }
    }
  });

  it('returns null rather than a colour that would not help', () => {
    /*
      Mid grey at AAA. Against a background this close to the middle, neither extreme gets
      there — black reaches 5.32:1 and white 3.95:1, both short of 7 — so there is genuinely
      no shade to offer.

      Worth noting the case that does NOT belong here: at 4.5 every background is fixable by
      black or white, so a null at that target means something went wrong upstream rather
      than the colour being unfixable. An earlier version of this test asserted null for
      `#808080` on `#7F7F7F` at 4.5 and failed correctly — the solver had found `#131313`,
      which passes at 4.78:1.
    */
    expect(computeSuggestedFix('#808080', '#7F7F7F', 7)).toBeNull();
  });

  it('measures translucent colours instead of reporting them as failures', () => {
    /*
      The dataset has 19 `rgba(255,255,255,0.08)` borders. A hex-only parser returned null
      for every one, and a null ratio renders as "Fail" — so the audit reported a measured
      failure for a colour it had never measured, and the checker claimed no shade could
      reach the target while white against the same background gives 17.85:1.
    */
    const ratio = contrastRatio('rgba(255,255,255,0.08)', '#0F172A');
    expect(ratio).not.toBeNull();

    // 8% white over near-black is a faint border, so it should measure as faint — the point
    // is that it measures at all, not that it passes.
    expect(ratio!).toBeLessThan(3);
    expect(ratio!).toBeGreaterThan(1);
  });

  it('composites a translucent foreground rather than treating it as opaque', () => {
    const translucent = contrastRatio('rgba(255,255,255,0.08)', '#0F172A')!;
    const opaque = contrastRatio('#FFFFFF', '#0F172A')!;
    expect(translucent).toBeLessThan(opaque);
  });

  it('no audited pair is reported as failing without being measured', () => {
    // The failure mode this whole fix addresses: a null ratio shown to the user as "Fail".
    for (const output of SAMPLE) {
      for (const pair of auditAccessibility(output).contrastPairs) {
        expect(
          pair.ratio,
          `${output.category} / ${pair.label}: ${pair.foreground} on ${pair.background} was never measured`,
        ).not.toBeNull();
      }
    }
  });

  it('returns null when the input is unusable rather than throwing', () => {
    expect(computeSuggestedFix('', '#FFFFFF', 4.5)).toBeNull();
    expect(computeSuggestedFix('#000000', '', 4.5)).toBeNull();
  });

  it('does not offer the colour it was already given', () => {
    // A fix identical to the current value is not a fix; it would render a button that
    // appears to do something and changes nothing.
    for (const output of SAMPLE) {
      for (const pair of auditAccessibility(output).contrastPairs) {
        if (pair.suggestedFix) {
          expect(pair.suggestedFix.toUpperCase()).not.toBe(pair.foreground.toUpperCase());
        }
      }
    }
  });
});
