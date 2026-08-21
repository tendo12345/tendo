/**
 * The page ground for a generated system.
 *
 * The engine picks a flat background colour. This derives a gradient ground from it, using
 * only colours already in the generated palette — no new hues are introduced, so the ground
 * cannot drift away from the system it belongs to.
 *
 * The opacity is not chosen by eye. `solveWashAlpha` walks the wash strength down until
 * every text role still clears its WCAG target against the worst composite the gradient can
 * produce, and returns the strongest value that passes. That makes the ground safe by
 * construction rather than by inspection — the same discipline the app's own chrome was
 * tuned with, applied automatically to every product.
 */

import { contrastRatio, isDark, matchLuminance, mix, relativeLuminance } from './color';
import { buildSemanticTokens } from './semanticTokens';
import type { DesignSystemOutput } from './types';

/** Held over each role's bar so float noise can never push the emitted ground under it. */
const SAFETY_MARGIN = 0.06;

export interface GroundStop {
  /** CSS colour, already composited where it needs to be. */
  color: string;
  /** Position in the linear ramp, 0–100. */
  position: number;
}

export interface GroundWash {
  /** Readable placement, e.g. "top right". */
  placement: string;
  color: string;
  alpha: number;
  /** The full CSS radial-gradient() layer. */
  css: string;
}

export interface Ground {
  /** The complete CSS value for `background-image`. */
  css: string;
  ramp: GroundStop[];
  washes: GroundWash[];
  /** Darkest and lightest pixel the ground can produce, as measured during solving. */
  extremes: { darkest: string; lightest: string };
  /** Worst contrast any text role has against the ground, and which role it was. */
  worstContrast: { role: string; ratio: number; against: string };
  /** Always 'derived' — the dataset carries no gradient for any product. */
  origin: 'derived';
  note: string;
}

/**
 * Text roles that must stay legible on the ground, each with the bar it has to clear.
 *
 * The bar is NOT simply the WCAG target. Some generated palettes already fail against their
 * own flat background — a dark-navy primary on a near-black ground sits at 1.15:1, and a
 * light palette's derived muted text can start at 3.44:1. The ground cannot repair those,
 * and refusing to build a ground until they are fixed would just mean no product ever gets
 * one.
 *
 * So the invariant is: **the ground may never make a role worse than the flat background
 * already was.** Where the palette meets its target, the ground must keep meeting it. Where
 * the palette already falls short, the ground must at least preserve what is there. Fixing
 * the palette itself is the Accessibility pane's job, and it reports exactly these failures.
 */
function textRoles(
  output: DesignSystemOutput,
): Array<{ role: string; color: string; target: number; baseline: number }> {
  const tokens = buildSemanticTokens(output);
  const v = (name: string) => tokens.find((t) => t.name === name)?.value ?? output.colors.foreground;
  const bg = output.colors.background;

  return [
    { role: 'text.primary', color: v('color.text.primary'), target: 4.5 },
    { role: 'text.secondary', color: v('color.text.secondary'), target: 4.5 },
    { role: 'text.muted', color: v('color.text.muted'), target: 4.5 },
    { role: 'action.primary', color: output.colors.primary, target: 3 },
  ].map((r) => {
    const baseline = contrastRatio(r.color, bg) ?? 0;
    // Never demand more of the ground than the flat background itself delivers, and hold a
    // small margin over that bar. Without it the solver stops exactly on the line and float
    // noise from the luminance bisection lets the emitted ground land ~0.02 under, which
    // would make the guarantee approximate rather than true.
    return { ...r, baseline, target: Math.min(r.target, baseline) + SAFETY_MARGIN };
  });
}

/**
 * Composite a wash over a base at a given alpha. Straight source-over, matching what the
 * browser does for a `rgba()` radial gradient sitting on the ramp beneath it.
 */
function composite(base: string, wash: string, alpha: number): string {
  return mix(base, wash, alpha) ?? base;
}

/**
 * Find the strongest wash alpha where every text role still passes.
 *
 * The candidate composite is the wash at full strength over the ramp stop that hurts most —
 * a deliberate over-estimate, since in the rendered gradient the wash peak is positioned
 * off-canvas and never actually reaches that strength over that stop. Erring pessimistic
 * here means the shipped ground always has margin rather than sitting exactly on the line.
 */
function solveWashAlpha(
  output: DesignSystemOutput,
  rampStops: string[],
  washColors: string[],
  ceiling: number,
): { alpha: number; worst: { role: string; ratio: number; against: string } } {
  const roles = textRoles(output);

  for (let alpha = ceiling; alpha >= 0.02; alpha -= 0.02) {
    let worst: { role: string; ratio: number; against: string } | null = null;

    for (const stop of rampStops) {
      for (const wash of washColors) {
        const bg = composite(stop, wash, alpha);
        for (const r of roles) {
          const ratio = contrastRatio(r.color, bg) ?? 0;
          if (!worst || ratio < worst.ratio) worst = { role: r.role, ratio, against: bg };
          if (ratio < r.target) worst = { role: r.role, ratio: -1, against: bg };
          if (worst.ratio === -1) break;
        }
        if (worst?.ratio === -1) break;
      }
      if (worst?.ratio === -1) break;
    }

    if (worst && worst.ratio > 0) {
      return { alpha: Number(alpha.toFixed(2)), worst };
    }
  }

  // Nothing passed: fall back to no wash at all rather than shipping a failing ground.
  const flat = rampStops[0];
  const roleRatios = roles.map((r) => ({
    role: r.role,
    ratio: contrastRatio(r.color, flat) ?? 0,
    against: flat,
  }));
  roleRatios.sort((a, b) => a.ratio - b.ratio);
  return { alpha: 0, worst: roleRatios[0] };
}

/**
 * Solve the hue-lift stop.
 *
 * Tinting the ground toward the brand hue is what stops it reading flat, but a bright
 * primary also lightens it, and on a dark system that pushes muted text under 4.5:1 before
 * any wash is involved. The lift is therefore solved the same way the wash is: walk it down
 * until every text role passes against the tinted stop, then re-seat its luminance so the
 * hue shows without the brightness following.
 */
function solveLift(output: DesignSystemOutput, bg: string, dark: boolean): { color: string; factor: number } {
  const roles = textRoles(output);
  const ceiling = dark ? 0.18 : 0.07;

  for (let factor = ceiling; factor >= 0.01; factor -= 0.01) {
    const tinted = mix(bg, output.colors.primary, factor) ?? bg;
    // Pull the luminance back toward the original ground so the tint reads as hue, not glare.
    const seated = mix(tinted, dark ? '#000000' : '#FFFFFF', dark ? 0.12 : 0.06) ?? tinted;
    const passes = roles.every((r) => (contrastRatio(r.color, seated) ?? 0) >= r.target);
    if (passes) return { color: seated, factor: Number(factor.toFixed(2)) };
  }
  return { color: bg, factor: 0 };
}

export function buildGround(output: DesignSystemOutput): Ground {
  const bg = output.colors.background;
  const dark = isDark(bg);

  // The ramp moves hue and only a little luminance, which is what stops a flat read
  // without costing contrast. Both ends are derived from the generated background.
  /*
    The ramp's luminance excursion is solved too.

    Fixed excursions do not survive contact with real palettes: a 0.35 step toward black on
    a dark ground, or toward white on a light one, moves the background far enough that the
    muted text token fails on the end stops alone. The excursion is walked down until every
    stop passes, so the ramp is as deep as this particular palette can carry and no deeper.
  */
  const solveExcursion = (): number => {
    const roles = textRoles(output);
    for (let e = dark ? 0.35 : 0.2; e >= 0.02; e -= 0.02) {
      const lo = mix(bg, dark ? '#000000' : '#FFFFFF', e) ?? bg;
      const hi = mix(bg, '#000000', e * 0.45) ?? bg;
      const ok = [lo, hi].every((stop) =>
        roles.every((r) => (contrastRatio(r.color, stop) ?? 0) >= r.target),
      );
      if (ok) return Number(e.toFixed(2));
    }
    return 0;
  };

  const excursion = solveExcursion();
  const deep = mix(bg, dark ? '#000000' : '#FFFFFF', excursion) ?? bg;
  const settle = mix(bg, '#000000', excursion * 0.45) ?? bg;

  /*
    The washes are the brand hues re-seated to the background's own luminance.

    Using primary and accent at their natural lightness makes any visible wash impossible:
    the derived `text.muted` token sits barely above 4.5:1 on the flat background, so the
    first hint of a lighter or darker tint drops it under and the solver walks the strength
    down to nothing. Matching luminance first means the wash moves hue only, leaving the
    contrast underneath essentially untouched — so it can be laid on strongly enough to see.
  */
  const bgLuminance = relativeLuminance(bg) ?? 0;
  const washColors = [
    matchLuminance(output.colors.primary, bgLuminance),
    matchLuminance(output.colors.accent, bgLuminance),
  ];
  const washCeiling = dark ? 0.85 : 0.7;

  /*
    Lift and wash are solved together, not one after the other.

    Solved in sequence, the lift takes all the available headroom for itself: it stops at
    the strongest tint that still passes on its own, leaving nothing for a wash sitting on
    top of it, and every product ends up with a bare ramp. Walking the lift down and asking
    for a wash at each step finds the first pairing where both survive — which is what
    actually makes the ground read as a gradient rather than a tonal step.
  */
  let lift = solveLift(output, bg, dark);
  let solved = solveWashAlpha(
    output,
    [deep, lift.color, bg, settle],
    washColors,
    washCeiling,
  );

  if (solved.alpha === 0) {
    for (let factor = lift.factor; factor >= 0; factor -= 0.02) {
      const candidateLift =
        factor <= 0
          ? { color: bg, factor: 0 }
          : (() => {
              const tinted = mix(bg, output.colors.primary, factor) ?? bg;
              const seated = mix(tinted, dark ? '#000000' : '#FFFFFF', dark ? 0.12 : 0.06) ?? tinted;
              return { color: seated, factor: Number(factor.toFixed(2)) };
            })();
      const attempt = solveWashAlpha(
        output,
        [deep, candidateLift.color, bg, settle],
        washColors,
        washCeiling,
      );
      if (attempt.alpha > 0) {
        lift = candidateLift;
        solved = attempt;
        break;
      }
    }
  }

  const ramp: GroundStop[] = [
    { color: deep, position: 0 },
    { color: lift.color, position: 46 },
    { color: bg, position: 72 },
    { color: settle, position: 100 },
  ];

  const rampStops = ramp.map((s) => s.color);
  const { alpha, worst } = solved;

  const washes: GroundWash[] =
    alpha === 0
      ? []
      : [
          // The luminance-matched hues, not the raw palette values — these are what the
          // solver validated, and emitting anything else would ship an unchecked gradient.
          {
            placement: 'top right',
            color: washColors[0],
            alpha,
            css: `radial-gradient(42rem 42rem at 84% -8%, ${rgba(washColors[0], alpha)}, transparent 60%)`,
          },
          {
            placement: 'bottom left',
            color: washColors[1],
            alpha: Number((alpha * 0.8).toFixed(2)),
            css: `radial-gradient(50rem 38rem at 6% 106%, ${rgba(washColors[1], alpha * 0.8)}, transparent 62%)`,
          },
        ];

  const linear = `linear-gradient(176deg, ${ramp.map((s) => `${s.color} ${s.position}%`).join(', ')})`;
  const css = [...washes.map((w) => w.css), linear].join(',\n');

  // Extremes across the ramp and the strongest wash, for the record.
  const composited = rampStops.flatMap((s) =>
    alpha === 0 ? [s] : washColors.map((w) => composite(s, w, alpha)),
  );
  const sorted = [...rampStops, ...composited].sort(
    (a, b) => (contrastRatio(a, '#FFFFFF') ?? 1) - (contrastRatio(b, '#FFFFFF') ?? 1),
  );

  return {
    css,
    ramp,
    washes,
    extremes: { lightest: sorted[0], darkest: sorted[sorted.length - 1] },
    worstContrast: { role: worst.role, ratio: Number(worst.ratio.toFixed(2)), against: worst.against },
    origin: 'derived',
    note:
      alpha === 0
        ? `Derived from the generated palette. No colour wash could be applied without dropping a text role below its contrast target, so this ground is the tonal ramp alone.`
        : `Derived from the generated palette — no new hues. The wash strength (${alpha}) is the strongest value at which every text role still meets its contrast target against the worst point the gradient can produce.`,
  };
}

function rgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(2))})`;
}
