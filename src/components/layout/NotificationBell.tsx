import { useEffect, useId, useRef, useState } from 'react';
import styles from './NotificationBell.module.css';

/*
  The notification control.

  READ THIS BEFORE ADDING A BADGE OR A COUNT.

  Basis has no notification system. Nothing in the engine, the store or Supabase produces an
  event addressed to a user — there is no queue, no unread state and no source to read from.
  So this panel says exactly that, and shows nothing else.

  What it deliberately does NOT do: render a dot, a number, or a list of plausible-looking
  items. This codebase's rule is that a feature which cannot be built honestly is absent
  rather than stubbed, and an unread badge over an empty queue is the clearest possible
  version of the thing that rule forbids — it invents a fact about the user's account.

  If notifications become real, the honest sources already in the app are replies to a user's
  blog comments and, for admins, the pending report queue. Both need a query that does not
  exist yet; wire this to one of them rather than to a placeholder.

  Behaviour matches NavMenu: Escape closes and restores focus, an outside pointerdown closes.
*/
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

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
    <div ref={wrapRef} className={styles.wrap}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <svg className={styles.icon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5v2.8L4 13h12l-1.5-3.2V7A4.5 4.5 0 0 0 10 2.5Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M8 15.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {/* The accessible name never claims a count, because there is nothing to count. */}
        <span className="visually-hidden">Notifications</span>
      </button>

      {open && (
        <div id={panelId} className={styles.panel} role="status">
          <p className={styles.empty}>No notifications</p>
          <p className={styles.note}>Basis does not send notifications yet.</p>
        </div>
      )}
    </div>
  );
}
