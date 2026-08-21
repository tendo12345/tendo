import { describe, expect, it } from 'vitest';
import { generateDesignSystem } from '../engine/designSystem';
import { buildWhySummary } from './whySummary';

describe('buildWhySummary', () => {
  it('derives principles only from fields present on the real output', () => {
    const output = generateDesignSystem({
      productType: 'fintech mobile app',
      keywords: ['trustworthy', 'modern', 'minimal'],
    });
    const { sentence, principles } = buildWhySummary(output);

    expect(principles.length).toBeGreaterThan(0);
    expect(principles.length).toBeLessThanOrEqual(3);
    for (const p of principles) {
      const haystack = JSON.stringify(output).toLowerCase();
      expect(haystack).toContain(p.toLowerCase());
    }
    expect(sentence).toContain(output.category);
  });

  it('never returns duplicate principles', () => {
    const output = generateDesignSystem({ productType: 'general purpose app', keywords: [] });
    const { principles } = buildWhySummary(output);
    expect(new Set(principles.map((p) => p.toLowerCase())).size).toBe(principles.length);
  });
});
