/**
 * Derives radius, motion and density tokens from the matched style.
 *
 * The source data already carries these: every one of the 84 style rows has a
 * `Design System Variables` cell, and many spell out `--border-radius`, `--grid-gap`,
 * `--card-padding` or a transition duration. The Python engine reads that column into its
 * output columns and then never uses it, emitting the same hardcoded 8/12/16px radii and
 * 200ms transition for every query. This module uses it instead.
 *
 * Coverage is honest, not padded: roughly a quarter of styles declare a parseable radius
 * (22/84) or duration (21/84), and only 6 declare spacing. Where the style says nothing,
 * the ported constants are used unchanged and the token is marked `source: 'default'`, so
 * a consumer can always tell a derived value from a fallback.
 */

import { COMPONENT_TOKENS, RADIUS_SCALE, SPACING_SCALE } from './constants';
import type { ComponentTokens, RadiusScale, Row, SpacingScale } from './types';

export type TokenSource = 'style' | 'default';

export interface DerivedTokens {
  radius: RadiusScale[];
  spacing: SpacingScale[];
  components: ComponentTokens;
  motion: { duration: string; source: TokenSource };
  radiusSource: TokenSource;
  spacingSource: TokenSource;
  /** The raw declaration the values came from, for the reasoning text. */
  evidence: { radius?: string; spacing?: string; motion?: string };
}

/** `--border-radius: 14px`, `--radius-card: 12px`, `border-radius: 16-24px`, `--radius: 0` */
const RADIUS_RE =
  /(?:--(?:border-|corner-)?radius(?:-card|-box)?|border-radius)\s*:\s*(0|\d+(?:\s*-\s*\d+)?\s*(?:px|rem))/i;
/** `--grid-gap: 8px`, `--card-padding: 12px`, `gap: 8px` */
const GAP_RE = /(?:--grid-gap|--card-padding|\bgap|\bpadding)\s*:\s*(\d+(?:\s*-\s*\d+)?\s*px)/i;
/** `150-200ms`, `200ms`, `--transition-duration: 0s` */
const DURATION_RE = /(?:(\d+)\s*-\s*(\d+)\s*ms|(\d+)\s*ms|--(?:transition|animation)-duration\s*:\s*(0)s)/i;

/** Take the midpoint of a `16-24px` range, or the single value. Returns px as a number. */
function parseLength(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase();
  const range = cleaned.match(/^(\d+)\s*-\s*(\d+)\s*(px|rem)?$/);
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    const mid = Math.round((lo + hi) / 2);
    return range[3] === 'rem' ? mid * 16 : mid;
  }
  const single = cleaned.match(/^(\d+)\s*(px|rem)?$/);
  if (!single) return null;
  const n = Number(single[1]);
  return single[2] === 'rem' ? n * 16 : n;
}

function fieldsOf(style: Row): { tokens: string; motion: string } {
  const dsv = style['Design System Variables'] ?? '';
  const css = style['CSS/Technical Keywords'] ?? '';
  const fx = style['Effects & Animation'] ?? '';
  return { tokens: `${dsv} , ${css}`, motion: `${dsv} , ${css} , ${fx}` };
}

/**
 * Read the style's declared corner radius, in px. `null` when the style says nothing,
 * which is the common case (62 of 84 styles).
 */
export function readStyleRadius(style: Row): { px: number; raw: string } | null {
  const { tokens } = fieldsOf(style);
  const m = tokens.match(RADIUS_RE);
  if (!m) return null;
  const px = parseLength(m[1]);
  if (px === null) return null;
  return { px, raw: m[0].trim() };
}

export function readStyleDensity(style: Row): { px: number; raw: string } | null {
  const { tokens } = fieldsOf(style);
  const m = tokens.match(GAP_RE);
  if (!m) return null;
  const px = parseLength(m[1]);
  if (px === null || px === 0) return null;
  return { px, raw: m[0].trim() };
}

export function readStyleDuration(style: Row): { ms: number; raw: string } | null {
  const { motion } = fieldsOf(style);
  const m = motion.match(DURATION_RE);
  if (!m) return null;
  if (m[1] && m[2]) {
    return { ms: Math.round((Number(m[1]) + Number(m[2])) / 2), raw: m[0].trim() };
  }
  if (m[3]) return { ms: Number(m[3]), raw: m[0].trim() };
  if (m[4] !== undefined) return { ms: 0, raw: m[0].trim() };
  return null;
}

/**
 * Build the radius scale from a declared base radius.
 *
 * The style declares one corner radius, which is the value it actually means: brutalism
 * says 0px and means 0px everywhere. Larger surfaces step up by one 4px increment each,
 * and a 0px style stays 0px throughout rather than growing.
 */
function radiusScaleFrom(base: number): RadiusScale[] {
  const step = base === 0 ? 0 : 4;
  return [
    { token: '--radius-sm', value: `${base}px`, usage: 'Buttons, inputs' },
    { token: '--radius-md', value: `${base + step}px`, usage: 'Cards' },
    { token: '--radius-lg', value: `${base + step * 2}px`, usage: 'Modals' },
  ];
}

/** Rebuild the 7-step spacing ramp around a declared base gap, keeping the same shape. */
function spacingScaleFrom(base: number): SpacingScale[] {
  const multipliers = [0.5, 1, 2, 3, 4, 6, 8];
  return SPACING_SCALE.map((entry, i) => {
    const px = Math.max(2, Math.round(base * multipliers[i]));
    return { token: entry.token, px: `${px}px`, rem: `${px / 16}rem`, usage: entry.usage };
  });
}

/**
 * Derive every scale from one style row. Falls back to the ported constants per-token,
 * so a style that declares a radius but no spacing gets a derived radius and default
 * spacing rather than all-or-nothing.
 */
export function deriveStyleTokens(style: Row): DerivedTokens {
  const radius = readStyleRadius(style);
  const density = readStyleDensity(style);
  const duration = readStyleDuration(style);

  const radiusScale = radius ? radiusScaleFrom(radius.px) : RADIUS_SCALE;
  const spacingScale = density ? spacingScaleFrom(density.px) : SPACING_SCALE;

  const sm = radiusScale[0].value;
  const md = radiusScale[1].value;
  const lg = radiusScale[2].value;
  const transition = duration
    ? duration.ms === 0
      ? 'none'
      : `all ${duration.ms}ms ease`
    : COMPONENT_TOKENS.button.transition;

  return {
    radius: radiusScale,
    spacing: spacingScale,
    components: {
      button: { ...COMPONENT_TOKENS.button, radius: sm, transition },
      card: { ...COMPONENT_TOKENS.card, radius: md, transition },
      input: { ...COMPONENT_TOKENS.input, radius: sm },
      modal: { ...COMPONENT_TOKENS.modal, radius: lg },
    },
    motion: {
      duration: duration ? (duration.ms === 0 ? '0ms' : `${duration.ms}ms`) : '200ms',
      source: duration ? 'style' : 'default',
    },
    radiusSource: radius ? 'style' : 'default',
    spacingSource: density ? 'style' : 'default',
    evidence: {
      ...(radius ? { radius: radius.raw } : {}),
      ...(density ? { spacing: density.raw } : {}),
      ...(duration ? { motion: duration.raw } : {}),
    },
  };
}
