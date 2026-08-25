/**
 * Format conversion for `export_tokens`. Reuses the exact converters the app's own Export
 * pane uses (`src/lib/exportFormatters.ts`) so the MCP server can never drift from what a
 * human clicking "Download" in Basis would get.
 */

import { toCssVariables, toDesignTokensJson, toJson, toTailwindConfig } from '../../src/lib/exportFormatters';
import type { DesignSystemOutput } from '../../src/engine/types';

export const EXPORT_FORMATS = ['json', 'css-variables', 'tailwind-config', 'style-dictionary'] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function formatTokens(format: ExportFormat, system: DesignSystemOutput): { content: string; mimeType: string } {
  switch (format) {
    case 'json':
      return { content: toJson(system), mimeType: 'application/json' };
    case 'css-variables':
      return { content: toCssVariables(system), mimeType: 'text/css' };
    case 'tailwind-config':
      return { content: toTailwindConfig(system), mimeType: 'text/javascript' };
    case 'style-dictionary':
      // `toDesignTokensJson` already emits the { value, type } shape Style Dictionary and the
      // W3C design-tokens format share — no separate converter needed for this one.
      return { content: toDesignTokensJson(system), mimeType: 'application/json' };
  }
}
