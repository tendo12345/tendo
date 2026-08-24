import type { ReactNode } from 'react';
import styles from './Badge.module.css';

type BadgeTone = 'neutral' | 'positive' | 'warning' | 'negative';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

/** A small colored status pill. See `--app-warning`/`--app-warning-soft` in tokens.css. */
export function Badge({ children, tone = 'neutral', className = '' }: BadgeProps) {
  const classes = [styles.badge, styles[tone], className].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}
