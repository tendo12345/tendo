import { NavLink } from 'react-router-dom';
import { Button } from '../ui/Button';
import { ThemeToggle } from './ThemeToggle';
import { accountsEnabled } from '../../lib/supabase';
import styles from './NavBar.module.css';

export function NavBar() {
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
          {showAccount && (
            <NavLink to="/account" className={({ isActive }) => `${styles.link} ${isActive ? styles.linkActive : ''}`}>
              Account
            </NavLink>
          )}
        </nav>

        <div className={styles.actions}>
          <ThemeToggle />
          <Button href="/generator" variant="primary" size="sm">
            Start Generating
          </Button>
        </div>
      </div>
    </header>
  );
}
