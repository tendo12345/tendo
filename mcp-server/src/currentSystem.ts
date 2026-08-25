/**
 * Resolves "the current generated design system" for a client-side, backend-less app.
 *
 * Basis has no server and no database — a generated system only ever exists as
 * `GenerateInput` plus the pure, deterministic `generateDesignSystem()` call that rebuilds it
 * (see CLAUDE.md, "Saved systems store the input, not the output"). The MCP server follows
 * the same rule: it never invents or caches an output shape, it re-derives one from an input
 * every call.
 *
 * That input is resolved in priority order:
 *   1. Explicit arguments passed to the tool call (lets an agent ask about a different system
 *      without touching project config).
 *   2. `BASIS_PRODUCT_TYPE` / `BASIS_INDUSTRY` / `BASIS_KEYWORDS` / `BASIS_REGION` environment
 *      variables (set via the MCP client's `env` config, or the shell).
 *   3. `basis.config.json` at the repo root (or `BASIS_CONFIG_PATH`), shaped exactly like
 *      `GenerateInput` — the project's checked-in "this is our system" declaration.
 *   4. A bundled fallback so the server always returns real generated output, never an error,
 *      even in a repo that has configured nothing.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDesignSystem } from '../../src/engine';
import type { DesignSystemOutput, GenerateInput } from '../../src/engine/types';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Same query the landing page's precomputed sample uses (scripts/build-sample-system.ts) — real product output, not a placeholder. */
const FALLBACK_INPUT: GenerateInput = {
  productType: 'fintech mobile app',
  keywords: ['trustworthy', 'modern', 'minimal'],
};

export interface InputOverride {
  productType?: string;
  industry?: string;
  keywords?: string[];
  region?: string;
}

function cleanInput(raw: {
  productType: string;
  industry?: string;
  keywords?: string[];
  region?: string;
}): GenerateInput {
  const industry = raw.industry?.trim();
  const region = raw.region?.trim();
  return {
    productType: raw.productType.trim(),
    ...(industry ? { industry } : {}),
    keywords: (raw.keywords ?? []).map((k) => k.trim()).filter(Boolean),
    ...(region ? { region } : {}),
  };
}

function fromEnv(): GenerateInput | null {
  const productType = process.env.BASIS_PRODUCT_TYPE;
  if (!productType?.trim()) return null;
  return cleanInput({
    productType,
    industry: process.env.BASIS_INDUSTRY,
    keywords: (process.env.BASIS_KEYWORDS ?? '').split(',').map((k) => k.trim()),
    region: process.env.BASIS_REGION,
  });
}

function fromConfigFile(): GenerateInput | null {
  const configPath = process.env.BASIS_CONFIG_PATH
    ? resolve(process.env.BASIS_CONFIG_PATH)
    : resolve(REPO_ROOT, 'basis.config.json');
  if (!existsSync(configPath)) return null;

  try {
    const parsed: unknown = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Partial<GenerateInput>;
    if (!p.productType?.trim()) return null;
    return cleanInput({
      productType: p.productType,
      industry: p.industry,
      keywords: Array.isArray(p.keywords) ? p.keywords : [],
      region: p.region,
    });
  } catch {
    return null;
  }
}

/** Where the effective input came from, so tool output can be honest about it rather than presenting a fallback as configured. */
export type InputSource = 'tool arguments' | 'BASIS_* environment variables' | 'basis.config.json' | 'built-in default';

export function resolveInput(override?: InputOverride): { input: GenerateInput; source: InputSource } {
  if (override?.productType?.trim()) {
    return { input: cleanInput({ ...override, productType: override.productType }), source: 'tool arguments' };
  }

  const env = fromEnv();
  if (env) return { input: env, source: 'BASIS_* environment variables' };

  const config = fromConfigFile();
  if (config) return { input: config, source: 'basis.config.json' };

  return { input: FALLBACK_INPUT, source: 'built-in default' };
}

export function getCurrentSystem(
  override?: InputOverride,
): { system: DesignSystemOutput; input: GenerateInput; source: InputSource } {
  const { input, source } = resolveInput(override);
  const system = generateDesignSystem(input);
  return { system, input, source };
}
