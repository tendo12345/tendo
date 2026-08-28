import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { accountsEnabled } from '../../lib/supabase';
import styles from './SaveToAccountNotice.module.css';

const DISMISS_KEY = 'dsg-save-notice-dismissed';

/*
  Offers the signed-out visitor an account, once they have something worth keeping.

  The copy is careful about one thing. Saving is NOT blocked without an account — the store
  falls back to localSystemStore, which keeps systems in this browser. So the honest pitch is
  about WHERE a save goes and what happens to it, not a capability the visitor is missing:
  "stays in this browser, and clearing site data removes it" is true, and "you cannot save"
  would not be.

  Shown only when there is genuinely an account to offer. If Supabase is unconfigured this
  renders nothing at all, because inviting someone to sign in to a deployment with no auth is
  the same shown-and-broken failure the nav avoids.

  Dismissal is per-session rather than permanent. A visitor who closes it has answered for
  now; a visitor who comes back next week and generates something new is a different moment
  and may well want the offer. Permanent dismissal would also mean writing a durable record
  of a decision the user made once, casually.
*/
export function SaveToAccountNotice() {
  const { status } = useAuth();

  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // Storage disabled: treat as not dismissed. Showing the notice is the recoverable
      // outcome; silently hiding it because storage threw is not.
      return false;
    }
  });

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Nothing to persist to — it stays dismissed for this page view only.
    }
  }

  // `status` is 'loading' until the session resolves. Rendering during that window makes the
  // notice flash in and out for signed-in users on every page load.
  if (!accountsEnabled() || status !== 'signed-out' || dismissed) return null;

  return (
    <div className={`container ${styles.wrap}`}>
      <div className={styles.notice} role="status">
        <div className={styles.body}>
          <p className={styles.title}>Keep this system on your account</p>
          <p className={styles.text}>
            Systems you save now stay in this browser only — they do not sync, and clearing site
            data removes them. Sign in and they follow you between browsers and devices.
          </p>
        </div>

        <div className={styles.actions}>
          <Link to="/account" className={styles.signIn}>
            Sign in
          </Link>
          <button type="button" className={styles.dismiss} onClick={dismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
