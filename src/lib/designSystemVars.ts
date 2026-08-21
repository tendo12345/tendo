import type { CSSProperties } from 'react';
import type { DesignSystemOutput } from '../engine/types';

/**
 * Maps a generated system to `--ds-*` custom properties, scoped to whatever element this is
 * spread onto as inline `style`. Deliberately never touches `--app-*` (see src/styles/tokens.css)
 * so a generated palette can never bleed into the application's own chrome.
 */
export function designSystemStyleVars(output: DesignSystemOutput): CSSProperties {
  const vars: Record<string, string> = {
    '--ds-primary': output.colors.primary,
    '--ds-on-primary': output.colors.on_primary || '#FFFFFF',
    '--ds-secondary': output.colors.secondary,
    '--ds-accent': output.colors.accent,
    '--ds-background': output.colors.background,
    '--ds-foreground': output.colors.foreground,
    '--ds-muted': output.colors.muted || output.colors.background,
    '--ds-border': output.colors.border || output.colors.foreground,
    '--ds-destructive': output.colors.destructive || '#DC2626',
    '--ds-ring': output.colors.ring || output.colors.primary,
    '--ds-font-heading': `'${output.typography.heading}', sans-serif`,
    '--ds-font-body': `'${output.typography.body}', sans-serif`,

    '--ds-button-radius': output.components.button.radius,
    '--ds-button-padding': output.components.button.padding,
    '--ds-button-font-weight': output.components.button.fontWeight,
    '--ds-button-transition': output.components.button.transition,

    '--ds-card-radius': output.components.card.radius,
    '--ds-card-padding': output.components.card.padding,
    '--ds-card-shadow': output.components.card.shadow,
    '--ds-card-transition': output.components.card.transition,

    '--ds-input-radius': output.components.input.radius,
    '--ds-input-padding': output.components.input.padding,
    '--ds-input-font-size': output.components.input.fontSize,
    '--ds-input-border-color': output.components.input.borderColor,

    '--ds-modal-radius': output.components.modal.radius,
    '--ds-modal-padding': output.components.modal.padding,
    '--ds-modal-shadow': output.components.modal.shadow,
    '--ds-modal-max-width': output.components.modal.maxWidth,
  };

  // The derived ground, so previews and exports show the same page backdrop.
  vars['--ds-ground'] = output.ground.css;

  for (const s of output.spacing) {
    vars[s.token] = s.px;
  }
  for (const r of output.radius) {
    vars[r.token] = r.value;
  }
  for (const s of output.shadows) {
    vars[s.token] = s.value;
  }

  return vars as CSSProperties;
}
