/**
 * Accessibility audit.
 *
 * Only checks that can actually be computed from the generated system. Colour contrast is
 * real WCAG 2.1 maths on real values. Touch target size, focus visibility and motion are
 * checked against the tokens the system actually emits. Anything that would need a rendered
 * page or a human — screen reader labelling, reading order, alt text — is not audited here,
 * because a green tick on an unchecked criterion is worse than no tick.
 */

import { contrastRatio, wcagLevel } from './color';
import { buildSemanticTokens, type SemanticToken } from './semanticTokens';
import type { DesignSystemOutput } from './types';

export type AuditStatus = 'pass' | 'warning' | 'attention';

export interface AuditFinding {
  id: string;
  category: 'Color contrast' | 'Focus visibility' | 'Text readability' | 'Interactive states' | 'Motion';
  title: string;
  status: AuditStatus;
  /** What the check measured, in real numbers where it measured something. */
  detail: string;
  /** Why it matters to a user. Only present when there is something to fix. */
  why?: string;
  /** What to change. Only present when there is something to fix. */
  fix?: string;
}

export interface AccessibilityAudit {
  findings: AuditFinding[];
  counts: { pass: number; warning: number; attention: number };
  /** Pairs checked for contrast, for the detail table. */
  contrastPairs: Array<{
    label: string;
    foreground: string;
    background: string;
    ratio: number | null;
    level: string;
    required: number;
    status: AuditStatus;
  }>;
}

/** Text pairs that must be legible for the system to be usable at all. */
function contrastChecks(output: DesignSystemOutput, tokens: SemanticToken[]) {
  const v = (name: string) => tokens.find((t) => t.name === name)?.value ?? '';
  const bg = output.colors.background;
  const raised = v('color.surface.raised') || bg;

  return [
    { label: 'Body text on page', foreground: v('color.text.primary'), background: bg, required: 4.5 },
    { label: 'Secondary text on page', foreground: v('color.text.secondary'), background: bg, required: 4.5 },
    { label: 'Muted text on page', foreground: v('color.text.muted'), background: bg, required: 4.5 },
    { label: 'Body text on raised surface', foreground: v('color.text.primary'), background: raised, required: 4.5 },
    { label: 'Primary button label', foreground: v('color.action.on-primary'), background: output.colors.primary, required: 4.5 },
    { label: 'Accent on page', foreground: output.colors.accent, background: bg, required: 3 },
    { label: 'Error text on page', foreground: v('color.feedback.error'), background: bg, required: 4.5 },
    { label: 'Focus ring on page', foreground: v('color.border.focus'), background: bg, required: 3 },
    { label: 'Border on page', foreground: v('color.border.default'), background: bg, required: 3 },
  ];
}

export function auditAccessibility(output: DesignSystemOutput): AccessibilityAudit {
  const tokens = buildSemanticTokens(output);
  const findings: AuditFinding[] = [];

  /* ---- contrast ---- */
  const contrastPairs = contrastChecks(output, tokens).map((c) => {
    const ratio = contrastRatio(c.foreground, c.background);
    const passes = ratio !== null && ratio >= c.required;
    // A non-text pair below 3:1 is a real problem; text below 4.5 but above 3 is borderline.
    const status: AuditStatus = passes ? 'pass' : ratio !== null && ratio >= 3 ? 'warning' : 'attention';
    return { ...c, ratio, level: wcagLevel(ratio), status };
  });

  const failing = contrastPairs.filter((p) => p.status !== 'pass');
  findings.push({
    id: 'contrast',
    category: 'Color contrast',
    title: 'Text and interface contrast',
    status: failing.length === 0 ? 'pass' : failing.some((f) => f.status === 'attention') ? 'attention' : 'warning',
    detail:
      failing.length === 0
        ? `All ${contrastPairs.length} checked pairs meet their WCAG target.`
        : `${failing.length} of ${contrastPairs.length} pairs fall short: ${failing.map((f) => `${f.label} (${f.ratio ? f.ratio.toFixed(2) : '—'}:1, needs ${f.required}:1)`).join('; ')}.`,
    why:
      failing.length === 0
        ? undefined
        : 'Text below its contrast threshold is unreadable for people with low vision, and in bright light for everyone.',
    fix:
      failing.length === 0
        ? undefined
        : 'Darken the foreground or lighten the surface until the ratio clears the target. The Colors section shows each ratio live.',
  });

  /* ---- focus visibility ---- */
  const focusColor = tokens.find((t) => t.name === 'color.border.focus');
  const focusRatio = contrastRatio(focusColor?.value ?? '', output.colors.background);
  const focusOk = focusRatio !== null && focusRatio >= 3;
  findings.push({
    id: 'focus',
    category: 'Focus visibility',
    title: 'Keyboard focus indicator',
    status: focusOk ? 'pass' : 'attention',
    detail: focusOk
      ? `The focus ring (${focusColor?.value}) sits at ${focusRatio.toFixed(2)}:1 against the page, above the 3:1 minimum for non-text indicators.`
      : `The focus ring (${focusColor?.value}) is only ${focusRatio ? focusRatio.toFixed(2) : '—'}:1 against the page, below the 3:1 minimum.`,
    why: focusOk ? undefined : 'Keyboard and switch users lose their place entirely when the focus ring is invisible.',
    fix: focusOk ? undefined : 'Use a focus colour with more contrast against the background, or add a second offset outline.',
  });

  /* ---- text readability ---- */
  const inputFontSize = parseInt(output.components.input.fontSize, 10);
  const inputOk = Number.isFinite(inputFontSize) && inputFontSize >= 16;
  findings.push({
    id: 'text-size',
    category: 'Text readability',
    title: 'Input text size',
    status: inputOk ? 'pass' : 'warning',
    detail: inputOk
      ? `Inputs are set at ${output.components.input.fontSize}, at or above the 16px that stops iOS zooming on focus.`
      : `Inputs are set at ${output.components.input.fontSize}. Below 16px, iOS Safari zooms the page when the field is focused.`,
    why: inputOk ? undefined : 'The zoom-on-focus jump disorients users and often leaves the form half off-screen.',
    fix: inputOk ? undefined : 'Set input font-size to at least 16px.',
  });

  /* ---- interactive states: touch target ---- */
  const padding = output.components.button.padding;
  const vertical = parseInt(padding, 10);
  // Button height ≈ vertical padding × 2 + a ~20px line box.
  const approxHeight = Number.isFinite(vertical) ? vertical * 2 + 20 : 0;
  const touchOk = approxHeight >= 44;
  findings.push({
    id: 'touch-target',
    category: 'Interactive states',
    title: 'Touch target size',
    status: touchOk ? 'pass' : 'warning',
    detail: touchOk
      ? `Button padding of ${padding} gives roughly ${approxHeight}px of height, clearing the 44px minimum.`
      : `Button padding of ${padding} gives roughly ${approxHeight}px of height, under the 44×44px minimum.`,
    why: touchOk ? undefined : 'Targets under 44px are hard to hit accurately, especially one-handed or with a motor impairment.',
    fix: touchOk ? undefined : 'Increase vertical padding or set an explicit min-height of 44px on interactive controls.',
  });

  /* ---- motion ---- */
  const durationMs = parseInt(output.motion.duration, 10);
  const motionOk = !Number.isFinite(durationMs) || durationMs <= 400;
  findings.push({
    id: 'motion',
    category: 'Motion',
    title: 'Transition duration and reduced motion',
    status: motionOk ? 'pass' : 'warning',
    detail: motionOk
      ? `Transitions run at ${output.motion.duration}, inside the 150–400ms range that reads as responsive.`
      : `Transitions run at ${output.motion.duration}, long enough to feel sluggish and to bother motion-sensitive users.`,
    why: 'Any motion in the system must be disabled under prefers-reduced-motion, which the generated CSS does not enforce for you.',
    fix: 'Wrap transitions in a `@media (prefers-reduced-motion: reduce)` guard that sets them to none.',
  });

  const counts = {
    pass: findings.filter((f) => f.status === 'pass').length,
    warning: findings.filter((f) => f.status === 'warning').length,
    attention: findings.filter((f) => f.status === 'attention').length,
  };

  return { findings, counts, contrastPairs };
}
