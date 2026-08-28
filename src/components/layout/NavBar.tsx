import { NavLink } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { NavMenu } from './NavMenu';
import { accountsEnabled } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import styles from './NavBar.module.css';

/*
  Bar layout, following the reference.

    desktop   [logo] [links…] ······························ [account] [cta]
    mobile    [menu] [logo]   ······························ [cta]

  Two things are load-bearing rather than cosmetic:

  The links sit immediately after the logo, not centred. A centred group reads as a website
  masthead; left-grouped against the wordmark reads as an application, which is what this is.

  On mobile the menu trigger comes FIRST in the DOM, before the logo — not repositioned with
  CSS. Order matters for keyboard and screen-reader users, who meet the navigation before the
  home link exactly as a sighted user does, and a CSS-only reorder would have separated the
  two.

  The right group is the auth pair from the reference — a plain "Sign up" beside a filled
  "Log in" — and becomes a profile avatar once signed in.

  Both auth links go to /account, because Basis has ONE flow: sign-in is passwordless and the
  first link creates the account, so there is nothing separate to register. They are labelled
  as two only because the reference shows two; the page they land on handles either case.

  When Supabase is unconfigured the pair is hidden entirely rather than shown-and-broken,
  which is the same rule the rest of the app follows. That leaves the bar with no right-hand
  action in that deployment, which is correct: there is genuinely nothing to sign in to.

  There is no theme control: light and dark follow the browser or device via
  `prefers-color-scheme`. See the note in tokens.css.
*/
export function NavBar() {
  const { status, user, isAdmin } = useAuth();

  // Hidden entirely when unconfigured rather than shown-and-broken: a nav item leading to
  // "there is nothing to sign in to" is worse than no nav item.
  const showAccount = accountsEnabled();
  const signedIn = showAccount && status === 'signed-in' && user;

  return (
    <header className={styles.header}>
      <div className={`${styles.bar} container`}>
        {/* Mobile only. First in source order so it is also first for a keyboard. */}
        <NavMenu />

        <NavLink to="/" className={styles.logo}>
          <span className={styles.logoMark}>◆</span> Basis
        </NavLink>

        <nav className={styles.links} aria-label="Primary">
          <NavLink to="/generator" className={({ isActive }) => `${styles.link} ${isActive ? styles.linkActive : ''}`}>
            Generator
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => `${styles.link} ${isActive ? styles.linkActive : ''}`}>
            About
          </NavLink>
          <NavLink to="/blog" className={({ isActive }) => `${styles.link} ${isActive ? styles.linkActive : ''}`}>
            Blog
          </NavLink>
          {isAdmin && (
            <NavLink
              to="/admin/comments"
              className={({ isActive }) => `${styles.link} ${isActive ? styles.linkActive : ''}`}
            >
              Moderation
            </NavLink>
          )}
        </nav>

        <div className={styles.actions}>
          {showAccount && !signedIn && (
            <>
              <NavLink to="/account" className={styles.accountLink}>
                Sign up
              </NavLink>
              <Button href="/account" variant="primary" size="sm">
                Log in
              </Button>
            </>
          )}

          {/*
            Signed in: the avatar only.

            A notification control lived here and has been removed. Basis has no notification
            system — nothing in the engine, the store or Supabase produces an event addressed
            to a user — so the control could only ever open an empty panel. This codebase's
            rule is that features which cannot be built honestly are absent rather than
            stubbed, and a bell that never rings is the stub that rule describes.

            If notifications become real, the two honest sources already in the app are
            replies to a user's blog comments and the admin report queue.
          */}
          {signedIn && (
            <>
              <NavLink
                to="/account"
                className={({ isActive }) => `${styles.profile} ${isActive ? styles.profileActive : ''}`}
                aria-label="Your account"
              >
                <Avatar email={user.email ?? ''} size="sm" />
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
