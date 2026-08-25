#!/usr/bin/env node
/**
 * Basis MCP server.
 *
 * Exposes the current Basis-generated design system to AI coding agents (Claude Code,
 * Cursor, etc.) over stdio. See ./currentSystem.ts for how "current" is resolved, and the
 * README in this folder for how to register this server with a client.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { buildComponentTokenMap, buildComponentStates, buildSemanticTokens } from '../../src/engine';
import { EXPORT_FORMATS, formatTokens } from './formatters';
import { getCurrentSystem } from './currentSystem';

const server = new McpServer({ name: 'basis-design-system', version: '0.1.0' });

/** Shared across all three tools: lets an agent point at a different system than the configured "current" one, for a single call. */
const overrideShape = {
  productType: z
    .string()
    .optional()
    .describe(
      'Override the configured "current" system: a one-sentence product description to generate from instead (e.g. "b2b analytics dashboard"). Omit to use the project\'s configured system.',
    ),
  industry: z.string().optional().describe('Override: industry context, used only with productType.'),
  keywords: z.array(z.string()).optional().describe('Override: style keywords, used only with productType.'),
  region: z.string().optional().describe('Override: region preset, used only with productType.'),
};

server.registerTool(
  'get_design_system',
  {
    title: 'Get design system',
    description:
      "Returns the current Basis-generated design system as structured JSON: palette, typography, spacing/radius/shadow scales, component tokens, semantic token layer, and the reasoning behind each choice. Pass productType (and optionally industry/keywords/region) to generate a different system instead of the project's configured one.",
    inputSchema: overrideShape,
  },
  async (args) => {
    try {
      const { system, input, source } = getCurrentSystem(args);
      const semanticTokens = buildSemanticTokens(system);
      const payload = {
        source: `Resolved from: ${source}`,
        input,
        system,
        semanticTokens,
      };
      return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to generate design system: ${(err as Error).message}` }],
      };
    }
  },
);

server.registerTool(
  'export_tokens',
  {
    title: 'Export design tokens',
    description:
      'Converts the current Basis design system into a specific export format: raw JSON, CSS custom properties, a Tailwind config module, or a Style Dictionary / W3C design-tokens JSON file. Same converters the app\'s own Export pane uses.',
    inputSchema: {
      format: z.enum(EXPORT_FORMATS).describe('Output format: json | css-variables | tailwind-config | style-dictionary'),
      ...overrideShape,
    },
  },
  async ({ format, ...override }) => {
    try {
      const { system, source } = getCurrentSystem(override);
      const { content, mimeType } = formatTokens(format, system);
      return {
        content: [
          { type: 'text', text: `Source: ${source} · category: ${system.category} · format: ${format} (${mimeType})` },
          { type: 'text', text: content },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to export tokens: ${(err as Error).message}` }],
      };
    }
  },
);

server.registerTool(
  'list_components',
  {
    title: 'List components',
    description:
      'Returns the component rules and variants included in the current Basis design system: resting tokens for Button/Card/Input/Modal, each property\'s binding to a semantic token, and the full interaction-state set (hover/focus/active/disabled/loading/success/error) for Button and Input.',
    inputSchema: overrideShape,
  },
  async (args) => {
    try {
      const { system, source } = getCurrentSystem(args);
      const payload = {
        source: `Resolved from: ${source}`,
        category: system.category,
        style: system.style.name,
        components: system.components,
        tokenBindings: buildComponentTokenMap(system),
        states: buildComponentStates(system),
      };
      return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to list components: ${(err as Error).message}` }],
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('basis-design-system MCP server running on stdio');
