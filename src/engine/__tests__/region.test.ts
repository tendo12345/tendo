/**
 * Region assessment.
 *
 * The governing rule, as everywhere else here: say what is known and nothing more. A region
 * that is not in the table produces silence, not confident advice about someone's market.
 *
 * The load-bearing behaviour is the script check. The engine picks fonts by mood, so a
 * fintech app for the UAE gets a Latin pairing with no Arabic glyphs — a system that cannot
 * render its own product's language. Nothing else in the pipeline can catch that.
 */

import { describe, expect, it } from 'vitest';
import { generateDesignSystem } from '../designSystem';
import { assessRegion, profileRegion } from '../region';
import { hashOutput } from '../version';

const fintech = (region?: string) =>
  generateDesignSystem({ productType: 'fintech', keywords: ['mobile', 'trustworthy'], ...(region ? { region } : {}) });

describe('region never changes the generated system', () => {
  it('produces an identical system with or without a region', () => {
    // Region is assessed after the fact. If it ever reached BM25 it would shift ranking and
    // break parity with the Python original.
    expect(hashOutput(fintech('Nigeria'))).toBe(hashOutput(fintech()));
    expect(hashOutput(fintech('UAE'))).toBe(hashOutput(fintech('Japan')));
  });
});

describe('recognising a region', () => {
  it.each([
    ['Nigeria', 'Latin', 'ltr'],
    ['nigeria', 'Latin', 'ltr'],
    ['UAE', 'Arabic', 'rtl'],
    ['Saudi Arabia', 'Arabic', 'rtl'],
    ['Israel', 'Hebrew', 'rtl'],
    ['Japan', 'CJK-JP', 'ltr'],
    ['Thailand', 'Thai', 'ltr'],
  ])('%s -> %s, %s', (input, script, direction) => {
    const p = profileRegion(input);
    expect(p.recognised).toBe(true);
    expect(p.script).toBe(script);
    expect(p.direction).toBe(direction);
  });

  it('admits when it does not know a region rather than guessing', () => {
    const p = profileRegion('Atlantis');
    expect(p.recognised).toBe(false);
    expect(p.context).toEqual([]);
  });
});

describe('script coverage', () => {
  it('flags typography that cannot render the region script', () => {
    const a = assessRegion(fintech('UAE'))!;
    expect(a.typography!.coversScript).toBe(false);
    expect(a.typography!.note).toMatch(/no Arabic glyphs/i);
  });

  it('names the dataset pairing that would cover it', () => {
    const a = assessRegion(fintech('UAE'))!;
    expect(a.typography!.suggestion).toEqual({
      name: 'Arabic Elegant',
      heading: 'Noto Naskh Arabic',
      body: 'Noto Sans Arabic',
    });
  });

  it.each([
    ['Japan', 'Japanese Elegant'],
    ['Israel', 'Hebrew Modern'],
    ['Thailand', 'Thai Modern'],
    ['China', 'Chinese Simplified'],
  ])('suggests a real pairing for %s', (region, expected) => {
    expect(assessRegion(fintech(region))!.typography!.suggestion?.name).toBe(expected);
  });

  it('does not complain about a Latin-script region', () => {
    const a = assessRegion(fintech('Nigeria'))!;
    expect(a.typography!.coversScript).toBe(true);
    expect(a.typography!.suggestion).toBeNull();
  });
});

describe('direction', () => {
  it('is reported only where it changes layout', () => {
    expect(assessRegion(fintech('UAE'))!.direction?.value).toBe('rtl');
    expect(assessRegion(fintech('Nigeria'))!.direction).toBeNull();
  });
});

describe('guidance', () => {
  it('is always labelled as guidance, never as engine output', () => {
    for (const r of ['Nigeria', 'UAE', 'Atlantis', 'Brazil']) {
      expect(assessRegion(fintech(r))!.isGuidance).toBe(true);
    }
  });

  it('gives delivery context where it is well established', () => {
    const g = assessRegion(fintech('Nigeria'))!.guidance.join(' ');
    expect(g).toMatch(/low-end|Android/i);
    expect(g).toMatch(/data/i);
  });

  it('says plainly that an unknown region changed nothing', () => {
    const a = assessRegion(fintech('Atlantis'))!;
    expect(a.typography).toBeNull();
    expect(a.guidance.join(' ')).toMatch(/does not recognise/i);
    expect(a.guidance.join(' ')).toMatch(/nothing about your system was changed/i);
  });

  it('returns nothing at all when no region was given', () => {
    expect(assessRegion(fintech())).toBeNull();
  });
});
