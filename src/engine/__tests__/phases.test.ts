/**
 * Tests for the Phase B–E engine layers.
 *
 * The recurring rule: a check may only report what it actually measured. These tests exist
 * mostly to stop that slipping — that an audit never passes a criterion it did not test,
 * that derived colours are labelled derived, and that a variation which changed nothing
 * says so instead of pretending.
 */

import { describe, expect, it } from 'vitest';
import { auditAccessibility } from '../accessibility';
import { buildAiContext, buildBasisMarkdown, buildImplementationPrompt } from '../aiContext';
import { contrastRatio } from '../color';
import { buildComponentStates, stateContrastReport } from '../componentStates';
import { buildModes, deriveOppositeMode } from '../darkMode';
import { generateDesignSystem } from '../designSystem';
import { auditImportedTokens, importTokens } from '../importSystem';
import { buildProductPatterns } from '../productPatterns';
import { assessSystemHealth } from '../systemHealth';
import { DIRECTIONS, compareSystems, createVariation } from '../variations';
import products from '../../data/products.json';

type Row = Record<string, string>;

const fintech = generateDesignSystem({ productType: 'fintech', keywords: ['mobile', 'trustworthy'] });
const saas = generateDesignSystem({ productType: 'saas', keywords: ['dashboard', 'dark'] });
const shop = generateDesignSystem({ productType: 'ecommerce', keywords: ['fashion', 'luxury'] });

const SAMPLE = (products as Row[]).slice(0, 25).map((p) => {
  const w = p['Product Type'].split(/\s+/).filter(Boolean);
  return generateDesignSystem({ productType: w[0], keywords: w.slice(1) });
});

describe('accessibility audit', () => {
  it('reports a real contrast ratio for every pair it checks', () => {
    const audit = auditAccessibility(fintech);
    expect(audit.contrastPairs.length).toBeGreaterThan(5);
    for (const p of audit.contrastPairs) {
      expect(p.ratio, p.label).not.toBeNull();
      // The reported ratio must be the ratio of the two colours it names.
      expect(p.ratio!).toBeCloseTo(contrastRatio(p.foreground, p.background)!, 5);
    }
  });

  it('only claims a pass when the measured ratio actually meets the target', () => {
    for (const output of SAMPLE) {
      for (const p of auditAccessibility(output).contrastPairs) {
        if (p.status === 'pass') {
          expect(p.ratio!, `${output.category} ${p.label}`).toBeGreaterThanOrEqual(p.required);
        }
      }
    }
  });

  it('gives a why and a fix for anything not passing, and neither for a pass', () => {
    for (const output of SAMPLE) {
      for (const f of auditAccessibility(output).findings) {
        if (f.status === 'pass' && f.id !== 'motion') {
          expect(f.fix, f.title).toBeUndefined();
        } else if (f.status !== 'pass') {
          expect(f.why, f.title).toBeTruthy();
          expect(f.fix, f.title).toBeTruthy();
        }
      }
    }
  });

  it('does not audit criteria it cannot measure', () => {
    const ids = auditAccessibility(fintech).findings.map((f) => f.id);
    // No alt text, reading order or screen-reader checks: they need a rendered page.
    expect(ids).not.toContain('alt-text');
    expect(ids).not.toContain('reading-order');
    expect(ids).not.toContain('screen-reader');
  });

  it('counts add up to the findings', () => {
    const a = auditAccessibility(saas);
    expect(a.counts.pass + a.counts.warning + a.counts.attention).toBe(a.findings.length);
  });
});

describe('component states', () => {
  it('produces all eight states for each component', () => {
    for (const c of buildComponentStates(fintech)) {
      expect(c.applicable).toHaveLength(8);
      for (const s of c.applicable) {
        expect(c.states[s].background, `${c.component} ${s}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(c.states[s].note.length).toBeGreaterThan(15);
      }
    }
  });

  it('keeps the default state exactly as generated', () => {
    const button = buildComponentStates(fintech)[0];
    expect(button.states.default.background).toBe(fintech.colors.primary);
  });

  it('makes hover visibly different from default', () => {
    for (const output of SAMPLE) {
      const b = buildComponentStates(output)[0];
      expect(b.states.hover.background, output.category).not.toBe(b.states.default.background);
    }
  });

  it('gives focus a ring rather than only a colour change', () => {
    const b = buildComponentStates(fintech)[0];
    expect(b.states.focus.outline).toBeTruthy();
  });

  it('reports state contrast honestly instead of forcing it to pass', () => {
    const report = stateContrastReport(fintech);
    expect(report.length).toBe(16);
    for (const r of report) {
      expect(typeof r.ok).toBe('boolean');
      expect(r.ratio).not.toBeNull();
    }
  });

  it('keeps a disabled label perceivable, as its own note claims', () => {
    for (const output of SAMPLE) {
      for (const c of buildComponentStates(output)) {
        const d = c.states.disabled;
        const ratio = contrastRatio(d.foreground, d.background);
        expect(ratio, `${output.category} ${c.component} disabled`).toBeGreaterThanOrEqual(2.9);
      }
    }
  });
});

describe('system health', () => {
  it('backs every rating with a measurement', () => {
    for (const output of SAMPLE) {
      for (const area of assessSystemHealth(output).areas) {
        const label = `${output.category} ${area.area}`;
        if (area.area === 'Typography') {
          // Counting fonts would be meaningless; naming the selected pairing is the evidence.
          expect(area.measure, label).toMatch(
            new RegExp(`${output.typography.heading}|no pairing matched`, 'i'),
          );
        } else {
          expect(area.measure, label).toMatch(/\d/);
        }
      }
    }
  });

  it('offers an improvement only where the rating is not strong', () => {
    for (const area of assessSystemHealth(fintech).areas) {
      if (area.rating === 'strong') expect(area.improve, area.area).toBeUndefined();
      else expect(area.improve, area.area).toBeTruthy();
    }
  });

  it('surfaces the weakest areas first', () => {
    const h = assessSystemHealth(fintech);
    for (const w of h.weakest) expect(w.rating).not.toBe('strong');
  });
});

describe('derived mode', () => {
  it('returns the mode the engine did not generate', () => {
    const derived = deriveOppositeMode(fintech);
    // Fintech/Crypto generates a dark palette, so the companion is light.
    expect(derived.mode).toBe('light');
    expect(derived.isGenerated).toBe(false);
  });

  it('marks every colour in the derived mode as derived, never generated', () => {
    const derived = deriveOppositeMode(saas);
    for (const t of derived.tokens.filter((x) => x.group === 'color')) {
      expect(t.origin, t.name).toBe('derived');
    }
  });

  it('says plainly that it was derived', () => {
    expect(deriveOppositeMode(fintech).provenanceNote).toMatch(/derived, not generated/i);
  });

  it('is not a naive inversion — text stays legible on the new ground', () => {
    for (const output of SAMPLE) {
      const derived = deriveOppositeMode(output);
      const bg = derived.tokens.find((t) => t.name === 'color.surface.default')!.value;
      const fg = derived.tokens.find((t) => t.name === 'color.text.primary')!.value;
      expect(contrastRatio(fg, bg)!, output.category).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('returns both modes with exactly one marked as generated', () => {
    const modes = buildModes(fintech);
    expect(modes).toHaveLength(2);
    expect(modes.filter((m) => m.isGenerated)).toHaveLength(1);
  });
});

describe('product patterns', () => {
  it('always declares itself as guidance', () => {
    for (const output of SAMPLE) {
      expect(buildProductPatterns(output).isGuidance).toBe(true);
    }
  });

  it('picks a family from the matched category and says what it matched on', () => {
    const p = buildProductPatterns(fintech);
    expect(p.family).toBe('Fintech and payments');
    expect(p.matchedOn).toMatch(/matched on/i);
  });

  it('quotes the dataset key considerations rather than paraphrasing', () => {
    const p = buildProductPatterns(fintech);
    const row = (products as Row[]).find((r) => r['Product Type'] === fintech.category);
    expect(p.keyConsiderations).toBe(row!['Key Considerations'].trim());
  });

  it('falls back to universal patterns when no family matches', () => {
    const odd = generateDesignSystem({ productType: 'zzzz', keywords: ['qwerty'] });
    const p = buildProductPatterns(odd);
    expect(p.patterns.length).toBeGreaterThan(0);
  });
});

describe('variations', () => {
  it('re-runs the engine rather than post-processing the system', () => {
    const v = createVariation(fintech, DIRECTIONS[0]);
    // The variation's own input must carry the extra keywords.
    expect(v.input.keywords).toEqual(expect.arrayContaining(DIRECTIONS[0].keywords));
    expect(v.output.query).toContain(DIRECTIONS[0].keywords[0]);
  });

  it('leaves the original untouched', () => {
    const before = JSON.stringify(fintech);
    createVariation(fintech, DIRECTIONS[1]);
    expect(JSON.stringify(fintech)).toBe(before);
  });

  it('admits when a direction changed nothing', () => {
    let sawUnchanged = false;
    for (const d of DIRECTIONS) {
      const v = createVariation(shop, d);
      if (v.unchanged) {
        sawUnchanged = true;
        expect(v.changes).toHaveLength(0);
        expect(v.outcome).toMatch(/changed nothing/i);
      } else {
        expect(v.changes.length).toBeGreaterThan(0);
      }
    }
    // Not asserting that one must be unchanged — only that if it is, it says so.
    expect(typeof sawUnchanged).toBe('boolean');
  });

  it('flags when a direction moved the product category', () => {
    for (const d of DIRECTIONS) {
      const v = createVariation(fintech, d);
      const movedCategory = v.changes.some((c) => c.field === 'Product category');
      if (movedCategory) expect(v.outcome).toMatch(/product category/i);
    }
  });

  it('compares two systems field by field', () => {
    const rows = compareSystems(fintech, saas);
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.find((r) => r.field === 'Product category')!.same).toBe(false);
    const self = compareSystems(fintech, fintech);
    expect(self.every((r) => r.same)).toBe(true);
  });
});

describe('AI context', () => {
  it('includes every semantic token so an agent cannot invent one', () => {
    const ctx = buildAiContext(fintech);
    expect(ctx).toContain('color.action.primary');
    expect(ctx).toContain(fintech.colors.primary);
    expect(ctx).toContain('space.md');
  });

  it('states the rules that stop an agent drifting', () => {
    const ctx = buildAiContext(fintech);
    expect(ctx).toMatch(/do not introduce colors/i);
    expect(ctx).toMatch(/prefers-reduced-motion/i);
  });

  it('labels pattern recommendations as recommendations, not engine output', () => {
    expect(buildAiContext(fintech)).toMatch(/not engine output/i);
  });

  it('never claims an integration Basis does not have', () => {
    const ctx = buildAiContext(fintech);
    for (const claim of [/connected to/i, /integrates with/i, /sync(s|ed)? (to|with) (cursor|claude|v0)/i]) {
      expect(ctx).not.toMatch(claim);
    }
  });

  it('builds a BASIS.md with the sections a repo needs', () => {
    const md = buildBasisMarkdown(fintech);
    for (const heading of [
      '# BASIS.md', '## Product context', '## Design principles', '## Color',
      '## Typography', '## Spacing', '## Radius', '## Motion', '## Components',
      '## States', '## Accessibility', '## Do', "## Don't", '## Token rules',
    ]) {
      expect(md, heading).toContain(heading);
    }
  });

  it('carries token origins into BASIS.md so the reader knows what was defaulted', () => {
    const md = buildBasisMarkdown(fintech);
    expect(md).toMatch(/\| (generated|derived|default) \|/);
    expect(md).toMatch(/`default` is a Basis constant/);
  });

  it('turns anti-patterns into concrete don\'ts', () => {
    const md = buildBasisMarkdown(fintech);
    expect(md).toContain('Playful design');
  });

  it('builds an implementation prompt that carries the whole system', () => {
    const prompt = buildImplementationPrompt(fintech, 'dashboard');
    expect(prompt).toMatch(/^Build an analytics dashboard/);
    expect(prompt).toContain('color.action.primary');
    expect(prompt).toMatch(/WCAG AA/);
    expect(prompt).toMatch(/360px/);
  });

  it('uses the custom brief when asked', () => {
    const prompt = buildImplementationPrompt(fintech, 'custom', 'a settings screen');
    expect(prompt).toMatch(/^Build a settings screen/);
  });
});

describe('import and audit', () => {
  it('reads CSS custom properties', () => {
    const r = importTokens(`:root {\n  --color-primary: #2563EB;\n  --space-md: 16px;\n  --dur: 200ms;\n}`);
    expect(r.format).toBe('css');
    expect(r.tokens).toHaveLength(3);
    expect(r.tokens.find((t) => t.name === '--color-primary')!.kind).toBe('color');
    expect(r.tokens.find((t) => t.name === '--space-md')!.kind).toBe('length');
    expect(r.tokens.find((t) => t.name === '--dur')!.kind).toBe('duration');
  });

  it('reads a W3C design-token file', () => {
    const r = importTokens(JSON.stringify({ color: { primary: { $value: '#2563EB', $type: 'color' } } }));
    expect(r.format).toBe('w3c');
    expect(r.tokens[0].name).toBe('color.primary');
    expect(r.tokens[0].value).toBe('#2563EB');
  });

  it('reads plain nested JSON', () => {
    const r = importTokens(JSON.stringify({ colors: { brand: '#FF0000' }, spacing: { sm: '8px' } }));
    expect(r.format).toBe('json');
    expect(r.tokens.map((t) => t.name)).toEqual(['colors.brand', 'spacing.sm']);
  });

  it('says so rather than guessing when the format is unrecognisable', () => {
    const r = importTokens('this is not a design system');
    expect(r.format).toBe('unknown');
    expect(r.error).toBeTruthy();
    expect(r.tokens).toHaveLength(0);
  });

  it('reports invalid JSON as invalid', () => {
    const r = importTokens('{ "a": ');
    expect(r.error).toMatch(/not valid json/i);
  });

  it('finds duplicate values under different names', () => {
    const { tokens } = importTokens(':root { --brand: #2563EB; --link: #2563EB; }');
    const f = auditImportedTokens(tokens).find((x) => x.id === 'duplicates');
    expect(f).toBeTruthy();
    expect(f!.tokens.join(' ')).toContain('--brand');
  });

  it('finds spacing that breaks its own step', () => {
    const { tokens } = importTokens(':root { --space-1: 8px; --space-2: 16px; --space-3: 21px; }');
    const f = auditImportedTokens(tokens).find((x) => x.id === 'spacing-grid');
    expect(f!.severity).toBe('warning');
    expect(f!.tokens.join(' ')).toContain('--space-3');
  });

  it('passes a consistent spacing scale', () => {
    const { tokens } = importTokens(':root { --space-1: 8px; --space-2: 16px; --space-3: 32px; }');
    const f = auditImportedTokens(tokens).find((x) => x.id === 'spacing-grid');
    expect(f!.severity).toBe('info');
  });

  it('finds failing contrast between named text and background tokens', () => {
    const { tokens } = importTokens(':root { --background: #FFFFFF; --text-muted: #DDDDDD; }');
    const f = auditImportedTokens(tokens).find((x) => x.id === 'contrast');
    expect(f).toBeTruthy();
    expect(f!.tokens.join(' ')).toMatch(/text-muted/);
  });

  it('names the semantic roles that have no token', () => {
    const { tokens } = importTokens(':root { --background: #FFF; --text: #000; }');
    const f = auditImportedTokens(tokens).find((x) => x.id === 'missing-roles');
    expect(f!.detail).toMatch(/focus/);
    expect(f!.detail).toMatch(/error/);
  });

  it('offers no opinion on naming or taste', () => {
    const { tokens } = importTokens(':root { --xyz-thing: #2563EB; --space-1: 8px; }');
    const ids = auditImportedTokens(tokens).map((f) => f.id);
    expect(ids).not.toContain('naming');
    expect(ids).not.toContain('palette-quality');
  });
});
