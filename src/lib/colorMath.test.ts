import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToHsl, hexToRgb, wcagLevel } from './colorMath';

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#2563EB')).toEqual({ r: 37, g: 99, b: 235 });
  });

  it('parses 3-digit hex', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('parses without a leading #', () => {
    expect(hexToRgb('000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('returns null for invalid input', () => {
    expect(hexToRgb('not-a-color')).toBeNull();
    expect(hexToRgb('')).toBeNull();
  });
});

describe('hexToHsl', () => {
  it('converts white and black', () => {
    expect(hexToHsl('#FFFFFF')).toEqual({ h: 0, s: 0, l: 100 });
    expect(hexToHsl('#000000')).toEqual({ h: 0, s: 0, l: 0 });
  });

  it('returns null for invalid input', () => {
    expect(hexToHsl('nope')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for pure black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
  });

  it('is 1 for identical colors', () => {
    expect(contrastRatio('#2563EB', '#2563EB')).toBe(1);
  });

  it('returns null for unparsable colors', () => {
    expect(contrastRatio('bogus', '#fff')).toBeNull();
  });
});

describe('wcagLevel', () => {
  it('classifies known ratios', () => {
    expect(wcagLevel(21)).toBe('AAA');
    expect(wcagLevel(5)).toBe('AA');
    expect(wcagLevel(3.5)).toBe('AA Large');
    expect(wcagLevel(1.2)).toBe('Fail');
    expect(wcagLevel(null)).toBe('Fail');
  });
});
