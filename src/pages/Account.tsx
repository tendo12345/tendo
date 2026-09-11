import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSystemStore } from '../context/SystemStoreContext';
import { localSystemStore } from '../lib/localSystemStore';
import { createRemoteSystemStore, uploadLocalSystems } from '../lib/remoteSystemStore';
import { enabledOAuthProviders, type OAuthProvider } from '../lib/authProviders';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/ui/Avatar';
import styles from './Account.module.css';

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: 'Continue with Google',
  github: 'Continue with GitHub',
};

/**
 * Sign in, and manage what the account holds.
 *
 * Passwordless by design — see AuthContext. There is no password field on this page and no
 * account-creation step: the first sign-in link creates the account, so there is nothing to
 * "register" and no second flow to keep consistent.
 */
export default function AccountPage() {
  const { status, user, enabled, client, ensureClient, signInWithEmail, signInWithProvider, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  /*
    Where the guard turned them away from, captured ONCE on mount.

    Read into state rather than off `location` at redirect time because the effect below
    navigates, which replaces location.state — re-reading it would see the new empty state and
    the return path would vanish mid-flight.
  */
  const [returnTo] = useState<string | null>(() => {
    const from = (location.state as { from?: unknown } | null)?.from;
    // Only same-origin paths. A value from history state is attacker-influenceable, and
    // navigating to an absolute URL from it is an open redirect.
    return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : null;
  });
  const { systems, info, refresh } = useSystemStore();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<readonly OAuthProvider[]>([]);

  /*
    Only offer the OAuth providers the project has actually enabled.

    Both buttons used to render unconditionally and neither provider was on, so clicking one
    surfaced Supabase's raw "provider is not enabled" error. See `lib/authProviders.ts`.
  */
  useEffect(() => {
    let live = true;
    void enabledOAuthProviders().then((found) => {
      if (live) setProviders(found);
    });
    return () => {
      live = false;
    };
  }, []);

  /*
    Send them back where the guard stopped them.

    Signing in is a step in the visitor's task, not the task. Without this they authenticate and
    land on an account page, with the thing they actually wanted still one navigation away.

    `replace` so Back does not return to this page and immediately forward again.

    Placed above every early return on purpose. It first sat next to the signed-in branch, below
    `if (!enabled)`, which makes it a CONDITIONAL hook — the render order changes the moment
    accounts are unconfigured, and React throws "rendered more hooks than during the previous
    render". Same class of crash this app already took once from a hot-swapped hook list.
  */
  useEffect(() => {
    if (status !== 'signed-in' || !returnTo) return;
    navigate(returnTo, { replace: true });
  }, [status, returnTo, navigate]);

  /*
    Load the sign-in library while they type, not when they press the button.

    supabase-js is no longer on first load (lib/supabase.ts), so a signed-out visitor reaching
    this page has not downloaded it yet. Starting now means sending the link does not wait on
    a 50 kB fetch. Above the early returns for the same reason as the effect before it.
  */
  useEffect(() => {
    if (enabled && status === 'signed-out') void ensureClient();
  }, [enabled, status, ensureClient]);

  if (!enabled) {
    return (
      <div className={`container ${styles.wrap}`}>
        <h1 className={styles.title}>Accounts</h1>
        <div className={styles.notice}>
          <p className={styles.noticeTitle}>Not available in this deployment</p>
          <p className={styles.noticeBody}>
            No Supabase project is configured, so there is nothing to sign in to. Basis still
            works exactly as it does otherwise — your systems save to this browser, and share
            links work without an account.
          </p>
        </div>
        <Link className={styles.link} to="/generator">
          Back to the generator
        </Link>
      </div>
    );
  }

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await signInWithEmail(email.trim());
    setBusy(false);
    setSent(result.message);
  };

  const migrate = async () => {
    if (!client || !user) return;
    setBusy(true);
    try {
      const local = await localSystemStore.list();
      const remote = createRemoteSystemStore(client, user.id);
      const { uploaded, skipped } = await uploadLocalSystems(remote, local);
      await refresh();
      showToast(
        uploaded === 0
          ? 'Nothing new to copy — they are already in your account'
          : `Copied ${uploaded} system${uploaded === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} already there` : ''}`,
        'success',
      );
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'signed-in' && user) {
    return (
      <div className={`container ${styles.wrap}`}>
        <h1 className={styles.title}>Your Account</h1>
        <div className={styles.identity}>
          <Avatar email={user.email ?? ''} size="md" />
          <p className={styles.meta}>
            Signed in as <strong>{user.email}</strong>
          </p>
        </div>

        <div className={styles.panel}>
          <p className={styles.panelTitle}>Saved systems</p>
          <p className={styles.panelBody}>
            {systems.length === 0
              ? 'Nothing saved yet. Generate a system and save it from the Explore section.'
              : `${systems.length} saved. ${info.description}`}
          </p>
          <div className={styles.actions}>
            <Link className={styles.button} to="/system/explore">
              Manage saved systems
            </Link>
            <button type="button" className={styles.button} onClick={() => void migrate()} disabled={busy}>
              Copy this browser&rsquo;s systems here
            </button>
          </div>
        </div>

        <div className={styles.panel}>
          <p className={styles.panelTitle}>What is stored</p>
          <p className={styles.panelBody}>
            Your email address, and for each saved system the short description you typed —
            nothing else. Basis stores the description rather than the generated system, so a
            saved row is about sixty bytes and rebuilds when you open it.
          </p>
        </div>

        <button type="button" className={styles.signOut} onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className={`container ${styles.wrap}`}>
      <h1 className={styles.title}>Sign In</h1>
      {/*
        This line used to read "Basis works without one — everything generates and exports
        either way." Gating generation made that false, and a sign-in page that misstates why
        you are on it is exactly the dishonesty this product is built to avoid. Changed with the
        gate rather than after it.
      */}
      {/*
        Two versions, because the notice below carries the reason when the guard sent them here.
        Showing both produced "Generating a system needs an account." twice, stacked — written in
        separate commits and never seen together until the flow was walked end to end.
      */}
      <p className={styles.meta}>
        {returnTo
          ? 'Signing in also keeps your saved systems with you between browsers and devices.'
          : 'Generating a system needs an account. Signing in also keeps your saved systems with you between browsers and devices.'}
      </p>

      {/*
        Says why they are here. Arriving at a sign-in page you did not ask for, with no
        explanation, reads as the app losing your place rather than protecting something.
      */}
      {returnTo && (
        <div className={styles.notice} role="status">
          <p className={styles.noticeTitle}>Sign in to continue</p>
          <p className={styles.noticeBody}>
            Generating a design system needs an account. You will be taken straight back once you
            are signed in.
          </p>
        </div>
      )}

      {sent ? (
        <div className={styles.notice} role="status">
          <p className={styles.noticeTitle}>Check your email</p>
          <p className={styles.noticeBody}>{sent}</p>
        </div>
      ) : (
        <form className={styles.form} onSubmit={(e) => void submitEmail(e)}>
          <label className={styles.label} htmlFor="account-email">
            Email address
          </label>
          <input
            id="account-email"
            className={styles.input}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <button type="submit" className={styles.primary} disabled={busy || !email.trim()}>
            {busy ? 'Sending…' : 'Email me a sign-in link'}
          </button>
          <p className={styles.hint}>
            No password. The link signs you in once and creates your account if you do not have
            one.
          </p>
        </form>
      )}

      {providers.length > 0 && (
        <>
          <div className={styles.divider}>
            <span>or</span>
          </div>

          <div className={styles.actions}>
            {providers.map((provider) => (
              <button
                key={provider}
                type="button"
                className={styles.button}
                onClick={() => void signInWithProvider(provider)}
              >
                {PROVIDER_LABELS[provider]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
