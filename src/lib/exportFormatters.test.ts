import { describe, expect, it } from 'vitest';
import { generateDesignSystem } from '../engine/designSystem';
import { toCssVariables, toDesignTokensJson, toJson, toMarkdown, toTailwindConfig } from './exportFormatters';

const output = generateDesignSystem({
  productType: 'fintech mobile app',
  keywords: ['trustworthy', 'modern', 'minimal'],
});

describe('toCssVariables', () => {
  it('emits a :root block with the real colors and spacing tokens', () => {
    const css = toCssVariables(output);
    expect(css).toMatch(/^:root \{/);
    expect(css).toContain(output.colors.primary);
    for (const s of output.spacing) {
      expect(css).toContain(`${s.token}: ${s.px};`);
    }
  });
});

describe('toJson', () => {
  it('round-trips the full output', () => {
    const parsed = JSON.parse(toJson(output));
    expect(parsed.category).toBe(output.category);
    expect(parsed.colors.primary).toBe(output.colors.primary);
    expect(parsed.reasoning.style.decision).toBe(output.reasoning.style.decision);
  });
});

describe('toTailwindConfig', () => {
  it('embeds the real palette and font families', () => {
    const config = toTailwindConfig(output);
    expect(config).toContain(output.colors.primary);
    expect(config).toContain(output.typography.heading);
    expect(config).toContain('export default');
  });
});

describe('toDesignTokensJson', () => {
  it('produces a nested color/typography/spacing token tree', () => {
    const tokens = JSON.parse(toDesignTokensJson(output));
    expect(tokens.color.primary).toEqual({ value: output.colors.primary, type: 'color' });
    expect(tokens.typography.heading.value).toBe(output.typography.heading);
    expect(Object.keys(tokens.spacing).length).toBe(output.spacing.length);
  });
});

describe('toMarkdown', () => {
  it('includes the palette table and reasoning sections', () => {
    const md = toMarkdown(output);
    expect(md).toContain('# ');
    expect(md).toContain(output.colors.primary);
    expect(md).toContain('## Reasoning');
    expect(md).toContain(output.reasoning.style.why);
  });
});
