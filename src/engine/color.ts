/**
 * Colour maths for the engine.
 *
 * Kept inside the engine so it stays self-contained and dependency-free. `src/lib/colorMath.ts`
 * is the UI's own copy for display formatting; this one backs the accessibility audit, the
 * derived token layer and the dark-mode transform, all of which must be testable without React.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb | null {
  const raw = hex.trim().replace(/^#/, '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const clamp = (c: number) => Math.max(0, Math.min(255, Math.round(c)));
  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Blend two colours. `t` of 0 returns `a`, 1 returns `b`. */
export function mix(a: string, b: string, t: number): string | null {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return null;
  return toHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, 1–21. Null when either colour is unparsable. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type WcagLevel = 'AAA' | 'AA' | 'AA Large' | 'Fail';

export function wcagLevel(ratio: number | null): WcagLevel {
  if (ratio === null) return 'Fail';
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

/**
 * Re-seat a colour's lightness until its relative luminance matches a target, keeping its
 * hue.
 *
 * This is what lets a coloured wash sit over a background without touching contrast. Text
 * legibility depends on luminance, so a wash whose luminance already equals the ground's
 * can be laid on at any strength and the contrast ratio underneath is unchanged — the page
 * gains colour, not glare. Without it, any tint eats the headroom of whichever text role is
 * closest to its minimum, which for a derived "muted" token is usually all of it.
 */
export function matchLuminance(hex: string, target: number): string {
  const start = parseHex(hex);
  if (!start) return hex;

  const current = relativeLuminance(hex);
  if (current === null) return hex;

  const toward = current > target ? '#000000' : '#FFFFFF';
  let lo = 0;
  let hi = 1;

  // 18 bisections lands well inside a single 8-bit step.
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const candidate = mix(hex, toward, mid);
    if (!candidate) break;
    const lum = relativeLuminance(candidate);
    if (lum === null) break;
    if (current > target ? lum > target : lum < target) lo = mid;
    else hi = mid;
  }

  return mix(hex, toward, (lo + hi) / 2) ?? hex;
}

export function isDark(hex: string): boolean {
  const l = relativeLuminance(hex);
  return l !== null && l < 0.4;
}

/**
 * Nudge a colour until it clears a contrast target against `against`, or give up.
 *
 * Used only where the alternative is shipping a knowingly failing pair. Callers must label
 * the result as adjusted — it is no longer the value the engine chose.
 */
export function adjustForContrast(color: string, against: string, target: number): string {
  if (!parseHex(color) || !parseHex(against)) return color;

  // Both directions are tried rather than picking one from a lightness threshold. A
  // mid-tone ground is the case that breaks the shortcut: it can read as "dark" while
  // still being far too light for white to ever reach the target.
  let best = color;
  let bestRatio = contrastRatio(color, against) ?? 0;

  for (const end of ['#000000', '#FFFFFF']) {
    for (let step = 0; step <= 20; step++) {
      const candidate = mix(color, end, step / 20);
      if (!candidate) break;
      const ratio = contrastRatio(candidate, against);
      if (ratio === null) break;
      if (ratio >= target) return candidate;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = candidate;
      }
    }
  }

  // Target unreachable from this colour: return the most legible candidate found.
  return best;
}
