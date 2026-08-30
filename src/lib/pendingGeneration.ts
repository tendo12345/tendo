import type { GenerateInput } from '../engine/types';

const KEY = 'dsg-pending-generation';

/**
 * The system someone asked for before they were sent to sign in.
 *
 * Generation is gated behind an account, so a signed-out visitor who fills in the form is
 * redirected to `/account`. Without this, the redirect loses what they typed and they arrive
 * at a sign-in page with no idea why — then have to fill the form again afterwards. Holding
 * the input makes the sign-in a step in their task rather than an interruption of it.
 *
 * sessionStorage, not localStorage: the input is only meaningful for the round trip that is
 * happening now. A request from last week resurfacing after an unrelated sign-in would be a
 * surprise, and this is the user's own words about their own product — not something to keep
 * on their machine longer than the errand it belongs to.
 *
 * Every access is wrapped: storage throws in private browsing and when site data is blocked,
 * and none of those cases should break the flow. A lost pending input costs a re-typed form;
 * a thrown exception costs the page.
 */
export function storePendingGeneration(input: GenerateInput): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(input));
  } catch {
    // Storage unavailable. The visitor still reaches sign-in; they just re-enter the form.
  }
}

export function readPendingGeneration(): GenerateInput | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const candidate = parsed as Partial<GenerateInput>;
    /*
      Validated rather than trusted. This is read back out of storage, where a stale shape from
      an older release — or anything else that wrote to the key — would otherwise be handed
      straight to the engine. `productType` and `keywords` are the two fields generation cannot
      proceed without.
    */
    if (typeof candidate.productType !== 'string' || !candidate.productType) return null;
    if (!Array.isArray(candidate.keywords)) return null;

    return {
      productType: candidate.productType,
      keywords: candidate.keywords.filter((k): k is string => typeof k === 'string'),
      industry: typeof candidate.industry === 'string' ? candidate.industry : undefined,
      region: typeof candidate.region === 'string' ? candidate.region : undefined,
    };
  } catch {
    return null;
  }
}

export function clearPendingGeneration(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
