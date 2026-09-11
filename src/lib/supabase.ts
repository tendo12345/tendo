import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase, loaded only when there is something for it to do.
 *
 * Returning null rather than throwing is the important part: Basis works without an account,
 * and it must keep working for anyone who never signs in — including when this repo is
 * cloned and run with no `.env` at all. Accounts are additive. If a missing key could break
 * generation, the feature would have made the core product worse.
 *
 * Only the anon key belongs here. It is public by design and safe in a browser bundle
 * *because* row-level security is what actually protects the data — see supabase/schema.sql.
 * The service role key bypasses RLS entirely and must never appear in client code.
 *
 * WHY THE CLIENT IS LOADED ON DEMAND
 *
 * supabase-js is ~52 kB gzipped, and it used to be created at module load here — so every
 * visitor downloaded and parsed it before first paint, because the root AuthProvider imports
 * this file. But most visitors are signed out, and whether a visitor is signed out can be
 * answered WITHOUT the library: supabase-js keeps its session in localStorage under one known
 * key, and a sign-in callback arrives as known URL parameters. No stored session and no
 * callback means signed out, full stop.
 *
 * So `accountsEnabled()` is now a plain check on the keys, and `loadSupabase()` imports the
 * library the first time something genuinely needs it: a stored session, a sign-in callback
 * in the URL, a sign-in in another tab, the sign-in form, blog comments, moderation. A visitor
 * who is signed out and does none of those never downloads it at all.
 *
 * `loadSupabase()` is memoized: every caller shares ONE client. Two GoTrueClient instances in
 * one page fight over the same storage key and emit duplicate auth events.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * The project URL and public key, for the few endpoints supabase-js has no method for.
 *
 * Safe to export for the same reason the key is safe in the bundle at all: it is the anon
 * key, public by design, and RLS is what protects the data. `authProviders.ts` needs both to
 * read `/auth/v1/settings`, which the SDK does not wrap — and reads it with plain fetch, so the
 * account page can list sign-in options without loading the SDK for that alone.
 */
export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;

/** True when accounts are available in this deployment. Needs no library. */
export function accountsEnabled(): boolean {
  return Boolean(url && anonKey);
}

/**
 * Why accounts are unavailable, for honest UI copy.
 *
 * The UI hides account features entirely when unconfigured rather than showing a sign-in
 * button that cannot work.
 */
export const accountsDisabledReason = accountsEnabled()
  ? null
  : 'This deployment has no Supabase project configured, so accounts are unavailable. Saved systems stay in this browser.';

let pending: Promise<SupabaseClient | null> | null = null;

/** The shared client, importing supabase-js on first call. Null when unconfigured. */
export function loadSupabase(): Promise<SupabaseClient | null> {
  if (!url || !anonKey) return Promise.resolve(null);
  pending ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The session arrives in the URL fragment after a magic link or OAuth redirect.
        // It is read when the client is created — which is why hasPendingAuth() below
        // loads the client at once whenever such a callback is present.
        detectSessionInUrl: true,
      },
    }),
  );
  return pending;
}

/**
 * Where supabase-js keeps the session: `sb-<project ref>-auth-token`, the library's default
 * (verified against @supabase/supabase-js 2.112 — it derives the key from the URL's first
 * hostname label). Null when unconfigured.
 */
export const AUTH_STORAGE_KEY = url ? `sb-${hostLabel(url)}-auth-token` : null;

function hostLabel(value: string): string {
  try {
    return new URL(value).hostname.split('.')[0];
  } catch {
    return '';
  }
}

/**
 * Is `key` one supabase-js would store a session under?
 *
 * The exact default key, and — as a guard against a library upgrade changing the format —
 * anything shaped like it. A false positive only loads the client when it was not needed; a
 * false negative would show a signed-in visitor as signed out, which is the failure to avoid.
 */
export function isAuthStorageKey(key: string): boolean {
  return key === AUTH_STORAGE_KEY || /^sb-.+-auth-token$/.test(key);
}

/**
 * URL parameters supabase-js treats as a sign-in callback — implicit flow (the default, and
 * what this app uses) returns `access_token` or an `error*` in the fragment; PKCE returns
 * `code` in the query. Mirrors auth-js's own `parseParametersFromURL`, which reads both the
 * fragment and the query.
 */
const CALLBACK_PARAMS = ['access_token', 'refresh_token', 'error', 'error_code', 'error_description', 'code'];

/**
 * Does supabase-js have anything to do in this browser right now?
 *
 * True when a session is stored, or the URL carries a sign-in callback. When false, the
 * visitor is signed out, and the library does not need to load for anyone to know it.
 */
export function hasPendingAuth(location: Pick<Location, 'hash' | 'search'> = window.location): boolean {
  if (!accountsEnabled()) return false;

  const params = new URLSearchParams(location.search);
  if (location.hash.startsWith('#')) {
    try {
      new URLSearchParams(location.hash.slice(1)).forEach((_v, k) => params.set(k, _v));
    } catch {
      // a fragment that is not a query string is not a callback
    }
  }
  if (CALLBACK_PARAMS.some((p) => params.has(p))) return true;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && isAuthStorageKey(key)) return true;
    }
  } catch {
    // Storage blocked (some private modes). supabase-js could not persist a session there
    // either, so there is nothing stored to find.
  }
  return false;
}
