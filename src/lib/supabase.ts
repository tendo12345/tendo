import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client, or null when the project is not configured.
 *
 * Returning null rather than throwing is the important part: Basis works without an account,
 * and it must keep working for anyone who never signs in — including when this repo is
 * cloned and run with no `.env` at all. Accounts are additive. If a missing key could break
 * generation, the feature would have made the core product worse.
 *
 * Only the anon key belongs here. It is public by design and safe in a browser bundle
 * *because* row-level security is what actually protects the data — see supabase/schema.sql.
 * The service role key bypasses RLS entirely and must never appear in client code.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

if (url && anonKey) {
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // The session arrives in the URL fragment after a magic link or OAuth redirect.
      detectSessionInUrl: true,
    },
  });
}

export const supabase = client;

/** True when accounts are available in this deployment. */
export function accountsEnabled(): boolean {
  return client !== null;
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
