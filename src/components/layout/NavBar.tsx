import { NavLink } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { NavMenu } from './NavMenu';
import { accountsEnabled } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import styles from './NavBar.module.css';

/*
  Two navigations, one visible at a time.

  Desktop and tablet get the inline links; below 768px they are replaced by the dropdown. The
  swap is done in CSS rather than by rendering one or the other, so there is no layout shift
  while JS decides and no chance of a resize leaving the wrong one on screen.

  Both are rendered, which means both are in the DOM at once. That is deliberate but not free:
  the two lists must carry the same destinations under the same conditions, or the app gains a
  route that is reachable on one screen size and not another. NavMenu holds the same set —
  Generator, Account when Supabase is configured, About, Blog, and Moderation for admins.

  There is no theme control here any more. Light and dark follow the browser or device via
  `prefers-color-scheme`; see the note in tokens.css.
*/
export function NavBar() {
  const { status, user, isAdmin } = useAuth();

  // Hidden entirely when unconfigured rather than shown-and-broken: a nav item leading to
  // "there is nothing to sign in to" is worse than no nav item.
  const showAccount = accountsEnabled();

  return (
    <header className={styles.header}>
      <div className={`${styles.bar} container`}>
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
          {showAccount && (
            <NavLink
              to="/account"
              className={({ isActive }) => `${styles.link} ${styles.accountLink} ${isActive ? styles.linkActive : ''}`}
            >
              {status === 'signed-in' && user && <Avatar email={user.email ?? ''} size="sm" />}
              Account
            </NavLink>
          )}
        </nav>

        <div className={styles.actions}>
          {/*
            The avatar appears in the bar only on mobile. On wider screens the Account link
            above already carries it, and showing both would put the same face twice in one row.
          */}
          {showAccount && status === 'signed-in' && user && (
            <span className={styles.mobileAvatar}>
              <Avatar email={user.email ?? ''} size="sm" />
            </span>
          )}
          <NavMenu />
          <Button href="/generator" variant="primary" size="sm">
            Start Generating
          </Button>
        </div>
      </div>
    </header>
  );
}
