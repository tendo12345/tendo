import { NavLink } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { NavMenu } from './NavMenu';
import { ThemeToggle } from './ThemeToggle';
import { accountsEnabled } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import styles from './NavBar.module.css';

/*
  Navigation lives in one place: the menu.

  The bar previously carried inline links that were `display: none` below 767px, which meant a
  phone had no navigation at all — no Generator, no Blog, no Account, only the logo and the
  CTA. Consolidating into the dropdown fixes that and avoids the alternative, which was two
  parallel navigations showing the same four destinations side by side on desktop.

  Nothing became unreachable: every destination the inline links carried, including the
  admin-only Moderation route, is in NavMenu under the same conditions.
*/
export function NavBar() {
  const { status, user } = useAuth();
  const showAccount = accountsEnabled();

  return (
    <header className={styles.header}>
      <div className={`${styles.bar} container`}>
        <NavLink to="/" className={styles.logo}>
          <span className={styles.logoMark}>◆</span> Basis
        </NavLink>


        <div className={styles.actions}>
          {/* Signed-in avatar stays in the bar rather than moving into the menu: it is status,
              not navigation, and hiding it behind a click would remove the only at-a-glance
              signal that you are signed in. */}
          {showAccount && status === 'signed-in' && user && <Avatar email={user.email ?? ''} size="sm" />}
          <ThemeToggle />
          <NavMenu />
          {/*
            Hidden on the narrowest screens — see the note in NavBar.module.css. Generator is
            in the menu and the hero's own call to action is directly below, so nothing is lost.
          */}
          <span className={styles.barCta}>
            <Button href="/generator" variant="primary" size="sm">
              Start Generating
            </Button>
          </span>
        </div>
      </div>
    </header>
  );
}
