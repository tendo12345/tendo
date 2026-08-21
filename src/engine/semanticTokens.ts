/**
 * The semantic token layer.
 *
 * A presentation and architecture layer over the generated values — it renames and organises,
 * it never re-picks. `color.action.primary` is the palette's primary, not a new colour.
 *
 * Every token carries an `origin`:
 *   generated — the value came straight out of the engine
 *   derived   — computed from a generated value (mixing, contrast adjustment)
 *   default   — a documented Basis constant, because the dataset has no such role
 *
 * That distinction matters: the palette dataset has no success or warning colour, and
 * pretending otherwise would be exactly the invented precision this product exists to avoid.
 */

import { contrastRatio, isDark, mix } from './color';
import type { DesignSystemOutput } from './types';

export type TokenOrigin = 'generated' | 'derived' | 'default';

export type TokenGroup = 'color' | 'space' | 'radius' | 'motion' | 'font' | 'shadow';

export interface SemanticToken {
  /** Semantic name, e.g. `color.action.primary`. */
  name: string;
  value: string;
  group: TokenGroup;
  origin: TokenOrigin;
  /** Which engine field it came from, e.g. `colors.primary`. */
  source: string;
  /** What it is for, in the interface. */
  role: string;
  /** Where it shows up, for the inspector. */
  usedBy: string[];
}

/** True when the generated background is dark, so derived roles lean the right way. */
export function isDarkBackground(output: DesignSystemOutput): boolean {
  return isDark(output.colors.background);
}

/**
 * Feedback colours the palette dataset does not carry.
 *
 * Two variants each, picked once and checked for contrast against light and dark grounds
 * rather than generated per system. They are marked `default` so nobody mistakes them for
 * something the engine chose for this product.
 */
const FEEDBACK_DEFAULTS = {
  success: { onLight: '#15803D', onDark: '#4ADE80' },
  warning: { onLight: '#B45309', onDark: '#FBBF24' },
};

/** Body text must clear AA, with enough margin left that a tinted ground cannot sink it. */
const TEXT_CONTRAST_TARGET = 4.5;
const TEXT_CONTRAST_MARGIN = 0.6;

/**
 * Fade text toward the background, but stop before it stops being readable.
 *
 * The old derivation was a flat mix — muted text was always 50% of the way to the
 * background. That parks it at roughly 4.5:1 *by construction*: on many palettes it landed
 * within a hundredth of the minimum, and on some it started below it. It also left the page
 * with no contrast headroom at all, which is what reduced the generated ground to a bare
 * tonal ramp on 112 of 120 product types.
 *
 * Now the fade is a ceiling rather than a fixed amount. It backs off until the result clears
 * AA plus a margin, so muted text is as quiet as the palette can afford and no quieter. On
 * palettes with room this is identical to the old behaviour; on tight ones it is darker, and
 * legible.
 */
function fadeToward(
  foreground: string,
  background: string,
  amount: number,
): { value: string; source: string } {
  const bar = TEXT_CONTRAST_TARGET + TEXT_CONTRAST_MARGIN;
  const pct = Math.round(amount * 100);

  for (let fade = amount; fade > 0; fade -= 0.05) {
    const candidate = mix(foreground, background, fade);
    if (!candidate) break;
    if ((contrastRatio(candidate, background) ?? 0) >= bar) {
      const at = Math.round(fade * 100);
      return {
        value: candidate,
        source:
          at === pct
            ? `colors.foreground faded ${pct}% toward the background`
            : `colors.foreground faded ${at}% toward the background — ${pct}% would drop below ${bar}:1 on this palette`,
      };
    }
  }

  // Even a small fade fails, which means the palette's own foreground is close to its
  // background. Returning it unfaded is the most legible option available.
  return {
    value: foreground,
    source: 'colors.foreground unfaded — this palette has no contrast room to fade it',
  };
}

export function buildSemanticTokens(output: DesignSystemOutput): SemanticToken[] {
  const c = output.colors;
  const dark = isDarkBackground(output);
  const tokens: SemanticToken[] = [];

  const add = (t: SemanticToken) => tokens.push(t);

  /* ---- colour: action ---- */
  add({
    name: 'color.action.primary', value: c.primary, group: 'color', origin: 'generated',
    source: 'colors.primary', role: 'Primary actions and emphasis',
    usedBy: ['Primary button', 'Links', 'Active navigation', 'Focus ring'],
  });
  add({
    name: 'color.action.on-primary', value: c.on_primary || (dark ? '#0F172A' : '#FFFFFF'),
    group: 'color', origin: c.on_primary ? 'generated' : 'derived',
    source: c.on_primary ? 'colors.on_primary' : 'contrast against colors.primary',
    role: 'Text and icons on primary surfaces', usedBy: ['Primary button label'],
  });
  add({
    name: 'color.action.secondary', value: c.secondary, group: 'color', origin: 'generated',
    source: 'colors.secondary', role: 'Supporting actions',
    usedBy: ['Secondary button', 'Supporting UI'],
  });
  add({
    name: 'color.action.accent', value: c.accent, group: 'color', origin: 'generated',
    source: 'colors.accent', role: 'Highlights and call-to-action emphasis',
    usedBy: ['CTA button', 'Badges', 'Callouts'],
  });

  /* ---- colour: surface ---- */
  add({
    name: 'color.surface.default', value: c.background, group: 'color', origin: 'generated',
    source: 'colors.background', role: 'Page and base surface',
    usedBy: ['Page background', 'Modal backdrop base'],
  });
  const raised = c.muted || mix(c.background, dark ? '#FFFFFF' : '#000000', 0.04) || c.background;
  add({
    name: 'color.surface.raised', value: raised, group: 'color',
    origin: c.muted ? 'generated' : 'derived',
    source: c.muted ? 'colors.muted' : 'colors.background lifted 4%',
    role: 'Cards and raised panels', usedBy: ['Card', 'Popover', 'Table header'],
  });

  /* ---- colour: text ---- */
  add({
    name: 'color.text.primary', value: c.foreground, group: 'color', origin: 'generated',
    source: 'colors.foreground', role: 'Body and heading text',
    usedBy: ['Headings', 'Body copy'],
  });
  const secondaryText = fadeToward(c.foreground, c.background, 0.3);
  add({
    name: 'color.text.secondary', value: secondaryText.value, group: 'color', origin: 'derived',
    source: secondaryText.source, role: 'Supporting text', usedBy: ['Descriptions', 'Captions'],
  });
  const mutedText = fadeToward(c.foreground, c.background, 0.5);
  add({
    name: 'color.text.muted', value: mutedText.value, group: 'color', origin: 'derived',
    source: mutedText.source,
    role: 'De-emphasised text', usedBy: ['Placeholders', 'Metadata', 'Disabled labels'],
  });

  /* ---- colour: border ---- */
  add({
    name: 'color.border.default', value: c.border || mix(c.background, c.foreground, 0.15) || c.foreground,
    group: 'color', origin: c.border ? 'generated' : 'derived',
    source: c.border ? 'colors.border' : 'background mixed 15% toward foreground',
    role: 'Dividers and input borders', usedBy: ['Input', 'Card border', 'Table rules'],
  });
  add({
    name: 'color.border.focus', value: c.ring || c.primary, group: 'color',
    origin: c.ring ? 'generated' : 'derived',
    source: c.ring ? 'colors.ring' : 'colors.primary',
    role: 'Keyboard focus indication', usedBy: ['Focus ring on every interactive element'],
  });

  /* ---- colour: feedback ---- */
  add({
    name: 'color.feedback.error', value: c.destructive || '#DC2626', group: 'color',
    origin: c.destructive ? 'generated' : 'default',
    source: c.destructive ? 'colors.destructive' : 'Basis default',
    role: 'Errors and destructive actions', usedBy: ['Error text', 'Destructive button', 'Invalid input'],
  });
  add({
    name: 'color.feedback.success',
    value: dark ? FEEDBACK_DEFAULTS.success.onDark : FEEDBACK_DEFAULTS.success.onLight,
    group: 'color', origin: 'default',
    source: 'Basis default — the palette dataset has no success role',
    role: 'Confirmation and success', usedBy: ['Success toast', 'Valid input'],
  });
  add({
    name: 'color.feedback.warning',
    value: dark ? FEEDBACK_DEFAULTS.warning.onDark : FEEDBACK_DEFAULTS.warning.onLight,
    group: 'color', origin: 'default',
    source: 'Basis default — the palette dataset has no warning role',
    role: 'Warnings and cautions', usedBy: ['Warning banner', 'Caution state'],
  });

  /* ---- spacing ---- */
  const spacingRoles = ['Tight gaps', 'Inline spacing', 'Standard padding', 'Section padding', 'Large gaps', 'Section margins', 'Hero padding'];
  output.spacing.forEach((s, i) => {
    const suffix = s.token.replace('--space-', '');
    add({
      name: `space.${suffix}`, value: s.px, group: 'space',
      origin: output.provenance.tokens.spacing === 'style' ? 'generated' : 'default',
      source: output.provenance.tokens.spacing === 'style'
        ? `derived from ${output.style.name}'s declared density`
        : 'Basis default spacing ramp',
      role: spacingRoles[i] ?? s.usage, usedBy: [s.usage],
    });
  });

  /* ---- radius ---- */
  output.radius.forEach((r) => {
    const suffix = r.token.replace('--radius-', '');
    add({
      name: `radius.${suffix}`, value: r.value, group: 'radius',
      origin: output.provenance.tokens.radius === 'style' ? 'generated' : 'default',
      source: output.provenance.tokens.radius === 'style'
        ? `${output.style.name} declares this corner radius`
        : 'Basis default radius scale',
      role: r.usage, usedBy: [r.usage],
    });
  });

  /* ---- motion ---- */
  add({
    name: 'motion.fast', value: output.motion.duration, group: 'motion',
    origin: output.motion.source === 'style' ? 'generated' : 'default',
    source: output.motion.source === 'style'
      ? `${output.style.name} declares this duration`
      : 'Basis default duration',
    role: 'Interaction transitions', usedBy: ['Hover', 'Focus', 'Press'],
  });

  /* ---- type ---- */
  add({
    name: 'font.heading', value: output.typography.heading, group: 'font', origin: 'generated',
    source: 'typography.heading', role: 'Headings and display',
    usedBy: ['H1–H4', 'Display type'],
  });
  add({
    name: 'font.body', value: output.typography.body, group: 'font', origin: 'generated',
    source: 'typography.body', role: 'Body and interface text',
    usedBy: ['Paragraphs', 'Labels', 'Buttons'],
  });

  /* ---- shadow ---- */
  output.shadows.forEach((s) => {
    add({
      name: `shadow.${s.token.replace('--shadow-', '')}`, value: s.value, group: 'shadow',
      origin: 'default', source: 'Basis default shadow scale',
      role: s.usage, usedBy: [s.usage],
    });
  });

  return tokens;
}

/** Look up one token by its semantic name. */
export function findToken(tokens: SemanticToken[], name: string): SemanticToken | undefined {
  return tokens.find((t) => t.name === name);
}

/** Group tokens for display, preserving insertion order within each group. */
export function groupTokens(tokens: SemanticToken[]): Array<[TokenGroup, SemanticToken[]]> {
  const order: TokenGroup[] = ['color', 'font', 'space', 'radius', 'shadow', 'motion'];
  return order
    .map((g) => [g, tokens.filter((t) => t.group === g)] as [TokenGroup, SemanticToken[]])
    .filter(([, list]) => list.length > 0);
}

/**
 * The component-to-token map: how each generated component consumes the system.
 * Values are token names, so the UI can link straight into the inspector.
 */
export interface ComponentTokenMap {
  component: string;
  bindings: Array<{ property: string; token: string; value: string }>;
}

export function buildComponentTokenMap(output: DesignSystemOutput): ComponentTokenMap[] {
  const tokens = buildSemanticTokens(output);
  const v = (name: string) => findToken(tokens, name)?.value ?? '';
  const radiusName = (value: string) =>
    tokens.find((t) => t.group === 'radius' && t.value === value)?.name ?? 'radius.sm';

  return [
    {
      component: 'Primary button',
      bindings: [
        { property: 'Background', token: 'color.action.primary', value: v('color.action.primary') },
        { property: 'Text', token: 'color.action.on-primary', value: v('color.action.on-primary') },
        { property: 'Radius', token: radiusName(output.components.button.radius), value: output.components.button.radius },
        { property: 'Padding', token: 'space.md', value: output.components.button.padding },
        { property: 'Transition', token: 'motion.fast', value: output.components.button.transition },
      ],
    },
    {
      component: 'Card',
      bindings: [
        { property: 'Background', token: 'color.surface.raised', value: v('color.surface.raised') },
        { property: 'Border', token: 'color.border.default', value: v('color.border.default') },
        { property: 'Radius', token: radiusName(output.components.card.radius), value: output.components.card.radius },
        { property: 'Padding', token: 'space.lg', value: output.components.card.padding },
        { property: 'Shadow', token: 'shadow.md', value: output.components.card.shadow },
      ],
    },
    {
      component: 'Input',
      bindings: [
        { property: 'Border', token: 'color.border.default', value: output.components.input.borderColor },
        { property: 'Focus ring', token: 'color.border.focus', value: v('color.border.focus') },
        { property: 'Radius', token: radiusName(output.components.input.radius), value: output.components.input.radius },
        { property: 'Padding', token: 'space.md', value: output.components.input.padding },
        { property: 'Text size', token: 'font.body', value: output.components.input.fontSize },
      ],
    },
    {
      component: 'Modal',
      bindings: [
        { property: 'Surface', token: 'color.surface.raised', value: v('color.surface.raised') },
        { property: 'Radius', token: radiusName(output.components.modal.radius), value: output.components.modal.radius },
        { property: 'Padding', token: 'space.xl', value: output.components.modal.padding },
        { property: 'Shadow', token: 'shadow.xl', value: output.components.modal.shadow },
        { property: 'Max width', token: '—', value: output.components.modal.maxWidth },
      ],
    },
  ];
}
