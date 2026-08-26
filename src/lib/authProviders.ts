import { supabaseAnonKey, supabaseUrl } from './supabase';

/**
 * Which OAuth providers this Supabase project actually has turned on.
 *
 * The account page used to render "Continue with Google" and "Continue with GitHub"
 * unconditionally. Neither was enabled on the project, so both failed with Supabase's raw
 * `Unsupported provider: provider is not enabled` shown to the user as an error — an
 * affordance that could not work, which is exactly what `accountsEnabled()` already exists
 * to prevent one level up. This applies the same rule at provider granularity.
 *
 * Asking the project beats hard-coding a list: enabling Google in the Supabase dashboard
 * makes its button appear on its own, with no code change and no second place to update.
 */

/** The providers Basis has sign-in code for. A project may enable more; we do not offer them. */
export type OAuthProvider = 'google' | 'github';

const OFFERED: readonly OAuthProvider[] = ['google', 'github'];

/** Shape of the bit of `/auth/v1/settings` we read. */
interface AuthSettings {
  external?: Record<string, boolean | undefined>;
}

let inflight: Promise<readonly OAuthProvider[]> | null = null;

/**
 * Resolves to the offered providers this project has enabled, `[]` if none.
 *
 * Cached for the page's lifetime — the answer only changes when someone edits the Supabase
 * dashboard, and a reload picks that up.
 */
export function enabledOAuthProviders(): Promise<readonly OAuthProvider[]> {
  if (!supabaseUrl || !supabaseAnonKey) return Promise.resolve([]);
  inflight ??= fetchEnabled(supabaseUrl, supabaseAnonKey);
  return inflight;
}

async function fetchEnabled(url: string, key: string): Promise<readonly OAuthProvider[]> {
  /*
    Fails closed, on purpose.

    Every error path here returns `[]`, which hides the buttons. Showing a sign-in button we
    could not confirm works is the failure this module exists to remove, so an unreachable
    or malformed settings endpoint should look the same as a disabled provider. The cost is
    that a transient network blip hides working OAuth buttons until reload; magic-link
    sign-in is unaffected and remains on the page either way.
  */
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (!res.ok) return [];
    const body = (await res.json()) as AuthSettings;
    const external = body.external ?? {};
    return OFFERED.filter((provider) => external[provider] === true);
  } catch {
    return [];
  }
}

/** Test seam: drops the cached lookup so each case starts clean. */
export function resetProviderCacheForTests(): void {
  inflight = null;
}
