import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  /** Small mono kicker above the statement. Optional — existing call sites render without it. */
  label?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * An empty state, composed the way every other block in this system is: a small technical
 * label, a serif statement, a short mono explanation, then the action. No illustration — the
 * editorial hierarchy is the decoration.
 */
export function EmptyState({ label, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {label && <p className={styles.label}>{label}</p>}
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
      {action}
    </div>
  );
}
