/**
 * The opposite-mode token layer.
 *
 * The engine generates exactly one palette. Whether it is light or dark is a property of
 * the matched product type, not a choice the user made — so the other mode has to be
 * derived, and everything here is marked as such.
 *
 * It is not an inversion. Inverting a palette wrecks hue relationships and usually destroys
 * contrast. Instead the surfaces are rebuilt around a new ground, the text roles are
 * re-derived against it, and the brand hues are kept — lightened or darkened only as far as
 * contrast requires.
 */

import { adjustForContrast, contrastRatio, isDark, mix } from './color';
import { buildSemanticTokens, type SemanticToken } from './semanticTokens';
import type { DesignSystemOutput } from './types';

export type ColorMode = 'light' | 'dark';

export interface ModePalette {
  mode: ColorMode;
  /** True when this is the palette the engine actually generated. */
  isGenerated: boolean;
  tokens: SemanticToken[];
  /** Plain statement of where this palette came from, shown in the UI. */
  provenanceNote: string;
}

/** Neutral grounds used when building the mode the engine did not generate. */
const DARK_GROUND = '#0F1115';
const LIGHT_GROUND = '#FBFBFC';

function deriveToken(
  base: SemanticToken,
  value: string,
  source: string,
): SemanticToken {
  return { ...base, value, origin: 'derived', source };
}

/**
 * Build the opposite mode from a generated palette.
 *
 * Brand colours keep their identity; only their lightness moves, and only when contrast
 * against the new ground demands it.
 */
export function deriveOppositeMode(output: DesignSystemOutput): ModePalette {
  const generatedIsDark = isDark(output.colors.background);
  const targetMode: ColorMode = generatedIsDark ? 'light' : 'dark';
  const ground = generatedIsDark ? LIGHT_GROUND : DARK_GROUND;
  const inkTarget = generatedIsDark ? '#111318' : '#F5F6F8';

  const source = buildSemanticTokens(output);

  const tokens = source.map((t): SemanticToken => {
    if (t.group !== 'color') {
      // Spacing, radius, type and motion are mode-independent.
      return t;
    }

    switch (t.name) {
      case 'color.surface.default':
        return deriveToken(t, ground, `neutral ${targetMode} ground`);
      case 'color.surface.raised':
        return deriveToken(
          t,
          mix(ground, generatedIsDark ? '#000000' : '#FFFFFF', 0.05) ?? ground,
          `${targetMode} ground lifted 5%`,
        );
      case 'color.text.primary':
        return deriveToken(t, inkTarget, `neutral ${targetMode} ink`);
      case 'color.text.secondary':
        return deriveToken(t, mix(inkTarget, ground, 0.3) ?? inkTarget, 'ink mixed 30% toward the ground');
      case 'color.text.muted':
        return deriveToken(t, mix(inkTarget, ground, 0.5) ?? inkTarget, 'ink mixed 50% toward the ground');
      case 'color.border.default':
        return deriveToken(t, mix(ground, inkTarget, 0.18) ?? ground, 'ground mixed 18% toward ink');
      default: {
        // Brand and feedback hues: keep them, adjust only if they fail against the new ground.
        const ratio = contrastRatio(t.value, ground);
        const needs = t.name === 'color.action.on-primary' ? 0 : 3;
        if (needs === 0 || (ratio !== null && ratio >= needs)) {
          return deriveToken(t, t.value, `${t.source} — unchanged, already legible on the ${targetMode} ground`);
        }
        return deriveToken(
          t,
          adjustForContrast(t.value, ground, needs),
          `${t.source} — lightness adjusted to clear ${needs}:1 on the ${targetMode} ground`,
        );
      }
    }
  });

  // On-primary must be re-derived against whatever primary ended up as.
  const primary = tokens.find((t) => t.name === 'color.action.primary')?.value;
  const onPrimaryIndex = tokens.findIndex((t) => t.name === 'color.action.on-primary');
  if (primary && onPrimaryIndex >= 0) {
    tokens[onPrimaryIndex] = deriveToken(
      tokens[onPrimaryIndex],
      adjustForContrast(isDark(primary) ? '#FFFFFF' : '#111318', primary, 4.5),
      'contrast-adjusted against the adjusted primary',
    );
  }

  return {
    mode: targetMode,
    isGenerated: false,
    tokens,
    provenanceNote: `Derived, not generated. The engine produced a ${generatedIsDark ? 'dark' : 'light'} palette for this product; this ${targetMode} companion rebuilds the surfaces around a neutral ${targetMode} ground and keeps the brand hues, adjusting lightness only where contrast required it.`,
  };
}

/** Both modes, with the generated one flagged. */
export function buildModes(output: DesignSystemOutput): ModePalette[] {
  const generatedIsDark = isDark(output.colors.background);
  const generated: ModePalette = {
    mode: generatedIsDark ? 'dark' : 'light',
    isGenerated: true,
    tokens: buildSemanticTokens(output),
    provenanceNote: `Generated. This is the palette the engine selected for ${output.category}.`,
  };
  const derived = deriveOppositeMode(output);
  return generatedIsDark ? [derived, generated] : [generated, derived];
}
