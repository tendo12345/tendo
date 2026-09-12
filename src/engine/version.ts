/**
 * Engine identity and output fingerprinting.
 *
 * A saved system stores its *input*, not its output — the engine is deterministic, so 61
 * bytes of input regenerates the same 8 kB of system. That is what keeps saved rows from
 * going stale the way stored output does.
 *
 * The cost of that choice is drift: change the selection logic and an old input regenerates
 * into a different system. `ENGINE_VERSION` and `hashOutput` exist to make that drift
 * *visible* rather than silent — store both alongside the input, and on reload you can tell
 * the difference between "same system" and "this changed since you saved it".
 */

import type { DesignSystemOutput, GenerateInput } from './types';

/**
 * Bump when a change alters what the engine produces for an unchanged input.
 *
 * Not the package version, and not bumped for additive fields: this tracks *selection*.
 * Style matching, token derivation, palette or reasoning-data changes all move it.
 * Purely additive output (a new derived view) does not.
 */
export const ENGINE_VERSION = '2026.09.12';

/**
 * FNV-1a over the fields that constitute the design decisions.
 *
 * Deliberately not a cryptographic hash — nothing here is a security boundary, it only has
 * to change when the system changes. Sync, dependency-free, and stable across runs, which
 * `crypto.subtle` (async) and `Math.random`-seeded alternatives are not.
 *
 * Only decision-bearing fields are hashed. Including the whole output would make the hash
 * churn every time prose or a derived view changed, which would report drift that no user
 * could see.
 */
export function hashOutput(output: DesignSystemOutput): string {
  const decisions = JSON.stringify({
    category: output.category,
    style: output.style.name,
    colors: output.colors,
    typography: {
      heading: output.typography.heading,
      body: output.typography.body,
    },
    pattern: output.pattern.name,
    spacing: output.spacing.map((s) => s.px),
    radius: output.radius.map((r) => r.value),
    motion: output.motion.duration,
  });

  let hash = 0x811c9dc5;
  for (let i = 0; i < decisions.length; i++) {
    hash ^= decisions.charCodeAt(i);
    // The usual FNV prime multiply, kept in 32-bit range without BigInt.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Normalise an input so two equivalent saves produce the same key. */
export function normalizeInput(input: GenerateInput): GenerateInput {
  return {
    productType: input.productType.trim(),
    ...(input.industry?.trim() ? { industry: input.industry.trim() } : {}),
    keywords: (input.keywords ?? []).map((k) => k.trim()).filter(Boolean),
    ...(input.region?.trim() ? { region: input.region.trim() } : {}),
  };
}
