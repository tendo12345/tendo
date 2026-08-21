import type { ReactNode } from 'react';
import styles from './Chip.module.css';

interface ChipProps {
  children: ReactNode;
  onClick?: () => void;
  onRemove?: () => void;
  selected?: boolean;
  className?: string;
}

export function Chip({ children, onClick, onRemove, selected, className = '' }: ChipProps) {
  const classes = [styles.chip, onClick ? styles.clickable : '', selected ? styles.selected : '', className]
    .filter(Boolean)
    .join(' ');

  if (onClick && !onRemove) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-pressed={selected}>
        {children}
      </button>
    );
  }

  return (
    <span className={classes}>
      {children}
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={`Remove ${typeof children === 'string' ? children : 'item'}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
