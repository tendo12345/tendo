/**
 * Fixed scales.
 *
 * IMPORTANT: in the Python source these values are not reasoned about at all. They are
 * hardcoded literals inside `format_master_md()` in design_system.py and are byte-identical
 * for every query. They are reproduced here verbatim so the port stays faithful. If the
 * product should derive spacing/radius from the matched style or product type, that is a
 * new feature, not a port. See PORTING-NOTES.md, open question 1.
 */

import type { ComponentTokens, RadiusScale, ShadowScale, SpacingScale } from './types';

export const SPACING_SCALE: SpacingScale[] = [
  { token: '--space-xs', px: '4px', rem: '0.25rem', usage: 'Tight gaps' },
  { token: '--space-sm', px: '8px', rem: '0.5rem', usage: 'Icon gaps, inline spacing' },
  { token: '--space-md', px: '16px', rem: '1rem', usage: 'Standard padding' },
  { token: '--space-lg', px: '24px', rem: '1.5rem', usage: 'Section padding' },
  { token: '--space-xl', px: '32px', rem: '2rem', usage: 'Large gaps' },
  { token: '--space-2xl', px: '48px', rem: '3rem', usage: 'Section margins' },
  { token: '--space-3xl', px: '64px', rem: '4rem', usage: 'Hero padding' },
];

export const SHADOW_SCALE: ShadowScale[] = [
  { token: '--shadow-sm', value: '0 1px 2px rgba(0,0,0,0.05)', usage: 'Subtle lift' },
  { token: '--shadow-md', value: '0 4px 6px rgba(0,0,0,0.1)', usage: 'Cards, buttons' },
  { token: '--shadow-lg', value: '0 10px 15px rgba(0,0,0,0.1)', usage: 'Modals, dropdowns' },
  { token: '--shadow-xl', value: '0 20px 25px rgba(0,0,0,0.15)', usage: 'Hero images, featured cards' },
];

/**
 * The Python source has no named radius scale. These three values are the only radii it
 * emits (buttons/inputs 8px, cards 12px, modals 16px), named here so consumers have a
 * scale to reference. No new values were introduced.
 */
export const RADIUS_SCALE: RadiusScale[] = [
  { token: '--radius-sm', value: '8px', usage: 'Buttons, inputs' },
  { token: '--radius-md', value: '12px', usage: 'Cards' },
  { token: '--radius-lg', value: '16px', usage: 'Modals' },
];

/** Component specs as emitted by `format_master_md`, with the palette slots left to the caller. */
export const COMPONENT_TOKENS: ComponentTokens = {
  button: { radius: '8px', padding: '12px 24px', fontWeight: '600', transition: 'all 200ms ease' },
  card: { radius: '12px', padding: '24px', shadow: 'var(--shadow-md)', transition: 'all 200ms ease' },
  input: { radius: '8px', padding: '12px 16px', fontSize: '16px', borderColor: '#E2E8F0' },
  modal: { radius: '16px', padding: '32px', shadow: 'var(--shadow-xl)', maxWidth: '500px' },
};

/** Fallback used when no reasoning row matches the category (mirrors `_apply_reasoning`). */
export const DEFAULT_REASONING = {
  pattern: 'Hero + Features + CTA',
  style_priority: ['Minimalism', 'Flat Design'],
  color_mood: 'Professional',
  typography_mood: 'Clean',
  key_effects: 'Subtle hover transitions',
  anti_patterns: '',
  decision_rules: {} as Record<string, string>,
  severity: 'MEDIUM',
};

/** Palette fallbacks, matching the literals in the Python `generate()` return. */
export const COLOR_FALLBACKS = {
  primary: '#2563EB',
  secondary: '#3B82F6',
  accent: '#F97316',
  background: '#F8FAFC',
  foreground: '#1E293B',
};
