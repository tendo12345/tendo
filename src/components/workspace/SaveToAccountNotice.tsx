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

  On a phone it collapses to a single line. The short copy is a TRUNCATION, not a different
  claim: "Saves stay in this browser." is the same fact the long version opens with, minus the
  consequence and the pitch. What it must never become is "Sign in to save", which would be
  shorter, would read better, and would be false — saving works without an account.

  Both strings are in the DOM and one is display:none per breakpoint. That removes it from the
  accessibility tree too, so no reader gets the sentence twice.
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
          <p className={styles.short}>Saves stay in this browser.</p>
        </div>

        <div className={styles.actions}>
          <Link to="/account" className={styles.signIn}>
            Sign in
          </Link>
          {/*
            "Not now" is always the accessible name, on both layouts — and it is NOT an
            aria-label.

            An aria-label reading "Dismiss" was the first attempt, and it fails WCAG 2.5.3
            (Label in Name): on desktop the button visibly says "Not now", so a speech-input
            user saying "click Not now" would find nothing to match. The accessible name has to
            contain the visible label.

            So on a phone the words are hidden VISUALLY rather than removed, and the glyph that
            replaces them is aria-hidden. Same name in both layouts, no override.
          */}
          <button type="button" className={styles.dismiss} onClick={dismiss}>
            <span className={styles.dismissLong}>Not now</span>
            <span className={styles.dismissShort} aria-hidden="true">
              ×
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
