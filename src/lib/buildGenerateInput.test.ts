import { describe, expect, it } from 'vitest';
import { buildGenerateInput } from './buildGenerateInput';

const base = { productType: '', industry: '', keywords: [], region: '' };

describe('buildGenerateInput', () => {
  it('rejects an empty product type', () => {
    const result = buildGenerateInput(base);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/building/i);
  });

  it('rejects a whitespace-only product type', () => {
    const result = buildGenerateInput({ ...base, productType: '   ' });
    expect(result.ok).toBe(false);
  });

  it('accepts a minimal valid input with empty keywords', () => {
    const result = buildGenerateInput({ ...base, productType: 'fintech mobile app' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.productType).toBe('fintech mobile app');
      expect(result.input.keywords).toEqual([]);
      expect(result.input.industry).toBeUndefined();
      expect(result.input.region).toBeUndefined();
    }
  });

  it('omits industry when blank', () => {
    const result = buildGenerateInput({ ...base, productType: 'saas', industry: '   ' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.industry).toBeUndefined();
  });

  it('includes industry when provided', () => {
    const result = buildGenerateInput({ ...base, productType: 'saas', industry: 'healthcare' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.industry).toBe('healthcare');
  });

  it('omits region when blank but includes it when provided', () => {
    const withRegion = buildGenerateInput({ ...base, productType: 'saas', region: 'Southeast Asia' });
    expect(withRegion.ok).toBe(true);
    if (withRegion.ok) expect(withRegion.input.region).toBe('Southeast Asia');

    const withoutRegion = buildGenerateInput({ ...base, productType: 'saas' });
    expect(withoutRegion.ok).toBe(true);
    if (withoutRegion.ok) expect(withoutRegion.input.region).toBeUndefined();
  });

  it('trims, dedupes, and drops empty keywords', () => {
    const result = buildGenerateInput({
      ...base,
      productType: 'saas',
      keywords: [' Minimal ', 'minimal', 'Modern', '', '   '],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.keywords).toEqual(['Minimal', 'Modern']);
  });

  it('trims the product type', () => {
    const result = buildGenerateInput({ ...base, productType: '  fintech app  ' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.productType).toBe('fintech app');
  });
});
