import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { accountsEnabled } from '../../lib/supabase';
import bar from './NavBar.module.css';
import styles from './NavMenu.module.css';

/*
  The navigation menu.

  A dropdown is a small component with a large number of ways to be subtly broken, so the
  behaviours below are deliberate rather than incidental:

  - Escape closes it AND returns focus to the trigger. Without the second half, a keyboard
    user who dismisses the menu is left with focus on `document.body` and has to tab from the
    top of the page again.
  - A pointer press outside closes it, listened for on `pointerdown` rather than `click`, so
    the menu is gone before the underlying element reacts.
  - Navigating closes it. React Router does not unmount the header between routes, so without
    watching the location the panel stays open over the page it just took you to.
  - The trigger reports `aria-expanded` and owns the panel by id, so a screen reader announces
    the state rather than the user discovering it.

  Focus is NOT trapped. This is a menu, not a modal — tabbing past the last item should
  continue into the page, and trapping would make it behave like a dialog it is not.
*/

interface Item {
  to: string;
  label: string;
}

export function NavMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const { isAdmin } = useAuth();

  /*
    Account appears only when a Supabase project is configured — the same rule the rest of the
    app follows. A menu item leading to "there is nothing to sign in to" is worse than no item.
    Moderation is admin-only and carried here because this menu is the app's navigation; the
    route would otherwise be unreachable without typing the URL.
  */
  const items: Item[] = [
    { to: '/generator', label: 'Generator' },
    ...(accountsEnabled() ? [{ to: '/account', label: 'Account' }] : []),
    { to: '/about', label: 'About' },
    { to: '/blog', label: 'Blog' },
    ...(isAdmin ? [{ to: '/admin/comments', label: 'Moderation' }] : []),
  ];

  // Close on navigation. The header persists across routes, so this does not happen on its own.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    /* bar.menuWrap is what hides this from 768px up, where the inline links take over. */
    <div ref={wrapRef} className={`${styles.wrap} ${bar.menuWrap}`}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {/*
          The bars are decorative; the accessible name comes from the visually hidden text, so
          the control is never announced as an unlabelled button.
        */}
        <span className={styles.icon} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
      </button>

      {open && (
        <div id={panelId} className={styles.panel} role="menu">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              role="menuitem"
              className={({ isActive }) => `${styles.item} ${isActive ? styles.itemActive : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
