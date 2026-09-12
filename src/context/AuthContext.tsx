import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { accountsEnabled, hasPendingAuth, isAuthStorageKey, loadSupabase } from '../lib/supabase';

/**
 * Session state.
 *
 * Deliberately passwordless — magic link and OAuth only. No password field, no reset flow,
 * no hashing decisions, and nothing to leak in a breach. For a free tool that stores design
 * inputs, a password is pure liability with no benefit to the user.
 *
 * When Supabase is not configured this provider still mounts and simply reports
 * `enabled: false`, so nothing below it has to branch on whether the feature exists.
 *
 * supabase-js is loaded on demand — see lib/supabase.ts. A visitor with no stored session and
 * no sign-in callback in the URL is signed out from the first render, and the library never
 * loads for them unless they reach something that needs it. Anything that does calls
 * `ensureClient()`; anything that only matters when signed in reads `client`, which is always
 * loaded by then because the session came from it.
 */

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'unavailable';

/** The public-safe slice of profiles a signed-in user can read about themselves. */
export interface Profile {
  displayName: string;
  role: 'user' | 'admin';
}

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** Null while loading or signed out. Fetched alongside the session, not a separate context —
   *  it is a property of who is signed in, exactly like `user`. */
  profile: Profile | null;
  /** Derived from `profile`. False when signed out, unconfigured, or profile hasn't loaded yet. */
  isAdmin: boolean;
  /** False when this deployment has no Supabase project configured. */
  enabled: boolean;
  /**
   * The Supabase client once it has loaded, else null. Always loaded when signed in — the
   * session came from it — so signed-in-only code can rely on it. Code that needs it while
   * signed out (the sign-in form, public comments) calls `ensureClient()` instead.
   */
  client: SupabaseClient | null;
  /** Loads the client if it has not loaded yet. Resolves null when accounts are unavailable. */
  ensureClient: () => Promise<SupabaseClient | null>;
  error: string | null;
  /** Emails a one-time sign-in link. Resolves when the mail is sent, not when it is clicked. */
  signInWithEmail: (email: string) => Promise<{ sent: boolean; message: string }>;
  signInWithProvider: (provider: 'google' | 'github') => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const enabled = accountsEnabled();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  /*
    The first status is decided without the library.

    'loading' only when there is something to resolve — a stored session, or a sign-in
    callback in the URL. Otherwise the visitor is signed out, and saying so on the first
    render is both true and better than before: the old client-at-load version spent a frame
    in 'loading' for every visitor, which RequireAccount renders as a blank page.
  */
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (!enabled) return 'unavailable';
    return hasPendingAuth() ? 'loading' : 'signed-out';
  });
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // One shared client for the whole app (loadSupabase is memoized); this only publishes it.
  const ensureClient = useCallback(async () => {
    const loaded = await loadSupabase();
    if (loaded) setClient(loaded);
    return loaded;
  }, []);

  /*
    When to load it without being asked: a session to restore or a callback to complete, now;
    or a sign-in that happens in another tab later. Signing in from the emailed link opens a
    NEW tab, and this tab would otherwise show "Log in" until reloaded — the storage event is
    how it finds out, since the library that would normally relay it is not loaded here.
  */
  useEffect(() => {
    if (!enabled) return;
    if (hasPendingAuth()) void ensureClient();

    const onStorage = (event: StorageEvent) => {
      if (event.key && isAuthStorageKey(event.key)) void ensureClient();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [enabled, ensureClient]);

  /*
    Session tracking, wired to the client rather than to mount.

    Keyed on `client` so it attaches whenever the client becomes available, however that
    happened, and re-attaches correctly when React re-runs effects (StrictMode mounts twice in
    development): a one-shot subscription made inside ensureClient would be torn down by the
    first cleanup and never come back, leaving the nav blind to sign-in and sign-out.
  */
  useEffect(() => {
    if (!client) return;

    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setStatus(data.session ? 'signed-in' : 'signed-out');
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signed-in' : 'signed-out');
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [client]);

  useEffect(() => {
    if (!client || !session?.user) {
      setProfile(null);
      return;
    }

    let active = true;
    void client
      .from('profiles')
      .select('display_name, role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setProfile({ displayName: data.display_name as string, role: data.role as Profile['role'] });
      });

    return () => {
      active = false;
    };
  }, [client, session]);

  const signInWithEmail = useCallback(async (email: string) => {
    const auth = await ensureClient();
    if (!auth) return { sent: false, message: 'Accounts are not available here.' };
    setError(null);

    const { error: err } = await auth.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/account` },
    });

    /*
      Always the same wording, whether or not that address has an account — and whether or
      not the call succeeded.

      Saying "no account found" would turn this form into an email-enumeration oracle:
      anyone could test addresses for membership. The success path was already careful about
      that, but returning `err.message` verbatim on failure quietly reopened it. Supabase
      distinguishes "signups not allowed" from other failures once new signups are disabled —
      a normal hardening step — and that message would have gone straight to the visitor.

      Rate limiting is the one failure worth naming, because the visitor can act on it and it
      reveals nothing about whether the address exists. Everything else is logged for the
      operator and reported as the same neutral sentence.
    */
    if (err) {
      setError(err.message);
      const rateLimited = /rate limit|too many/i.test(err.message);
      if (rateLimited) {
        return {
          sent: false,
          message: 'Too many sign-in attempts just now. Wait a minute and try again.',
        };
      }
    }

    return {
      sent: !err,
      message: `If ${email} can receive mail, a sign-in link is on its way. The link works once and expires shortly.`,
    };
  }, [ensureClient]);

  const signInWithProvider = useCallback(
    async (provider: 'google' | 'github') => {
      const auth = await ensureClient();
      if (!auth) return;
      setError(null);
      const { error: err } = await auth.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/account` },
      });
      if (err) setError(err.message);
    },
    [ensureClient],
  );

  const signOut = useCallback(async () => {
    const auth = await ensureClient();
    if (!auth) return;
    await auth.auth.signOut();
  }, [ensureClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.role === 'admin',
      enabled,
      client,
      ensureClient,
      error,
      signInWithEmail,
      signInWithProvider,
      signOut,
    }),
    [status, session, profile, enabled, client, ensureClient, error, signInWithEmail, signInWithProvider, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
