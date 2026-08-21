import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { accountsEnabled, supabase } from '../lib/supabase';

/**
 * Session state.
 *
 * Deliberately passwordless — magic link and OAuth only. No password field, no reset flow,
 * no hashing decisions, and nothing to leak in a breach. For a free tool that stores design
 * inputs, a password is pure liability with no benefit to the user.
 *
 * When Supabase is not configured this provider still mounts and simply reports
 * `enabled: false`, so nothing below it has to branch on whether the feature exists.
 */

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'unavailable';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** False when this deployment has no Supabase project configured. */
  enabled: boolean;
  error: string | null;
  /** Emails a one-time sign-in link. Resolves when the mail is sent, not when it is clicked. */
  signInWithEmail: (email: string) => Promise<{ sent: boolean; message: string }>;
  signInWithProvider: (provider: 'google' | 'github') => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const enabled = accountsEnabled();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(enabled ? 'loading' : 'unavailable');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setStatus(data.session ? 'signed-in' : 'signed-out');
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signed-in' : 'signed-out');
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    if (!supabase) return { sent: false, message: 'Accounts are not available here.' };
    setError(null);

    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/account` },
    });

    if (err) {
      setError(err.message);
      return { sent: false, message: err.message };
    }

    /*
      Always the same wording, whether or not that address has an account.

      Saying "no account found" would turn this form into an email-enumeration oracle:
      anyone could test addresses for membership. The cost is a slightly vaguer message for
      someone who typos their address, which is the right side of that trade.
    */
    return {
      sent: true,
      message: `If ${email} can receive mail, a sign-in link is on its way. The link works once and expires shortly.`,
    };
  }, []);

  const signInWithProvider = useCallback(async (provider: 'google' | 'github') => {
    if (!supabase) return;
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/account` },
    });
    if (err) setError(err.message);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      enabled,
      error,
      signInWithEmail,
      signInWithProvider,
      signOut,
    }),
    [status, session, enabled, error, signInWithEmail, signInWithProvider, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
