import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSystemStore } from '../context/SystemStoreContext';
import { localSystemStore } from '../lib/localSystemStore';
import { createRemoteSystemStore, uploadLocalSystems } from '../lib/remoteSystemStore';
import { supabase } from '../lib/supabase';
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
  const { status, user, enabled, signInWithEmail, signInWithProvider, signOut } = useAuth();
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
    if (!supabase || !user) return;
    setBusy(true);
    try {
      const local = await localSystemStore.list();
      const remote = createRemoteSystemStore(supabase, user.id);
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
      <p className={styles.meta}>
        Accounts let your saved systems follow you between browsers. Basis works without one —
        everything generates and exports either way.
      </p>

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
