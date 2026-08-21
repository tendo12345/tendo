import type { GenerateInput } from '../engine/types';
import type { GeneratorFormState } from '../types/ui';

export type BuildGenerateInputResult =
  | { ok: true; input: GenerateInput }
  | { ok: false; error: string };

/**
 * Maps generator form state to the engine's `GenerateInput`. The only validation the engine
 * itself needs is a non-empty product description/type — everything else is optional. Empty
 * `industry`/`region` are omitted entirely rather than passed as empty strings, matching how
 * `buildQuery()` treats missing fields.
 */
export function buildGenerateInput(form: GeneratorFormState): BuildGenerateInputResult {
  const productType = (form.productType ?? '').trim();
  if (!productType) {
    return { ok: false, error: "Tell us a little more about what you're building." };
  }

  const industry = (form.industry ?? '').trim();
  const region = (form.region ?? '').trim();

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const raw of form.keywords ?? []) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(trimmed);
  }

  return {
    ok: true,
    input: {
      productType,
      ...(industry ? { industry } : {}),
      keywords,
      ...(region ? { region } : {}),
    },
  };
}
