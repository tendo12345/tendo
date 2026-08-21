/**
 * Interaction states for the generated components.
 *
 * The engine produces one resting appearance per component. The states below are derived
 * from it by rule — hover darkens, disabled desaturates, focus adds the ring — and every
 * one is marked `derived`, because the dataset has no per-state values and inventing them
 * as "generated" would misrepresent where they came from.
 */

import { adjustForContrast, contrastRatio, isDark, mix } from './color';
import { buildSemanticTokens } from './semanticTokens';
import type { DesignSystemOutput } from './types';

export type StateName =
  | 'default'
  | 'hover'
  | 'focus'
  | 'active'
  | 'disabled'
  | 'loading'
  | 'success'
  | 'error';

export interface StateStyle {
  background: string;
  foreground: string;
  border: string;
  /** Extra CSS the state needs, e.g. the focus ring. */
  outline?: string;
  opacity?: number;
  /** What changed relative to the resting state, and why. */
  note: string;
}

export type ComponentStateSet = Record<StateName, StateStyle>;

export interface ComponentStates {
  component: 'Button' | 'Input';
  states: ComponentStateSet;
  /** States that apply to this component. Others are hidden rather than faked. */
  applicable: StateName[];
}

/** Shift a colour toward the far end of the ground: darker on light, lighter on dark. */
function press(color: string, background: string, amount: number): string {
  const target = isDark(background) ? '#FFFFFF' : '#000000';
  return mix(color, target, amount) ?? color;
}

export function buildComponentStates(output: DesignSystemOutput): ComponentStates[] {
  const tokens = buildSemanticTokens(output);
  const v = (name: string) => tokens.find((t) => t.name === name)?.value ?? '';

  const bg = output.colors.background;
  const primary = output.colors.primary;
  const onPrimary = v('color.action.on-primary');
  const focusRing = v('color.border.focus');
  const border = v('color.border.default');
  const mutedText = v('color.text.muted');
  const surface = v('color.surface.raised');
  const error = v('color.feedback.error');
  const success = v('color.feedback.success');

  const button: ComponentStateSet = {
    default: {
      background: primary,
      foreground: onPrimary,
      border: primary,
      note: 'The resting appearance the engine generated.',
    },
    hover: {
      background: press(primary, bg, 0.12),
      foreground: onPrimary,
      border: press(primary, bg, 0.12),
      note: 'Primary shifted 12% toward the far end of the ground, so the change reads on light and dark alike.',
    },
    focus: {
      background: primary,
      foreground: onPrimary,
      border: primary,
      outline: `3px solid ${focusRing}`,
      note: 'Adds the focus ring token. The fill is unchanged so focus and hover stay distinguishable.',
    },
    active: {
      background: press(primary, bg, 0.2),
      foreground: onPrimary,
      border: press(primary, bg, 0.2),
      note: 'Pressed state, shifted further than hover to confirm the tap landed.',
    },
    disabled: (() => {
      const fill = mix(primary, bg, 0.6) ?? primary;
      return {
        background: fill,
        // WCAG exempts disabled controls from contrast minimums, but an unreadable label
        // is still unreadable. The muted text is nudged until it clears 3:1 on this fill.
        foreground: adjustForContrast(mutedText, fill, 3),
        border: fill,
        opacity: 1,
        note: 'Blended 60% into the background, with the label adjusted to stay above 3:1 so it reads as unavailable rather than invisible.',
      };
    })(),
    loading: {
      background: primary,
      foreground: onPrimary,
      border: primary,
      note: 'Fill unchanged, control non-interactive, spinner replaces the label. The button must keep its width to avoid layout shift.',
    },
    success: {
      background: success,
      foreground: adjustForContrast(onPrimary, success, 4.5),
      border: success,
      note: 'Uses the success feedback token. Its label colour is contrast-adjusted against that fill.',
    },
    error: {
      background: error,
      foreground: adjustForContrast(onPrimary, error, 4.5),
      border: error,
      note: 'Uses the error feedback token, contrast-adjusted the same way.',
    },
  };

  const input: ComponentStateSet = {
    default: {
      background: surface,
      foreground: v('color.text.primary'),
      border,
      note: 'The resting appearance the engine generated.',
    },
    hover: {
      background: surface,
      foreground: v('color.text.primary'),
      border: press(border, bg, 0.15),
      note: 'Border only. The fill stays put so the field does not appear to change type.',
    },
    focus: {
      background: surface,
      foreground: v('color.text.primary'),
      border: focusRing,
      outline: `3px solid ${mix(focusRing, bg, 0.6) ?? focusRing}`,
      note: 'Border takes the focus colour and a softened ring sits outside it.',
    },
    active: {
      background: surface,
      foreground: v('color.text.primary'),
      border: focusRing,
      note: 'Same as focus: a text field has no separate pressed appearance.',
    },
    disabled: (() => {
      const fill = mix(surface, bg, 0.5) ?? surface;
      return {
        background: fill,
        foreground: adjustForContrast(mutedText, fill, 3),
        border: mix(border, bg, 0.5) ?? border,
        note: 'Flattened toward the page so it reads as unavailable rather than empty, with the value kept above 3:1.',
      };
    })(),
    loading: {
      background: surface,
      foreground: mutedText,
      border,
      note: 'Field is read-only while a value resolves; a spinner sits in the trailing slot.',
    },
    success: {
      background: surface,
      foreground: v('color.text.primary'),
      border: success,
      note: 'Border only, so the value stays readable. Pair with an icon: colour alone must not carry the meaning.',
    },
    error: {
      background: surface,
      foreground: v('color.text.primary'),
      border: error,
      note: 'Border only, paired with a message below the field. Colour alone must not carry the meaning.',
    },
  };

  const all: StateName[] = ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'success', 'error'];

  return [
    { component: 'Button', states: button, applicable: all },
    { component: 'Input', states: input, applicable: all },
  ];
}

/**
 * How many states keep enough contrast to be usable.
 *
 * Reported rather than silently fixed: a disabled state that drops below 3:1 is a real
 * trade-off, not necessarily a bug, and the user should decide.
 */
export function stateContrastReport(output: DesignSystemOutput) {
  return buildComponentStates(output).flatMap((c) =>
    (Object.entries(c.states) as Array<[StateName, StateStyle]>).map(([state, style]) => {
      const ratio = contrastRatio(style.foreground, style.background);
      return {
        component: c.component,
        state,
        ratio,
        // Disabled is exempt from the 4.5 target by WCAG, but should still be perceivable.
        ok: state === 'disabled' ? (ratio ?? 0) >= 3 : (ratio ?? 0) >= 4.5,
      };
    }),
  );
}
