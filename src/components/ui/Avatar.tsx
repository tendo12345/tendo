import styles from './Avatar.module.css';

interface AvatarProps {
  email: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function initialsFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  const segments = local.split(/[._+-]+/).filter(Boolean);
  if (segments.length >= 2) {
    return (segments[0][0] + segments[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function Avatar({ email, size = 'md', className = '' }: AvatarProps) {
  const classes = [styles.avatar, styles[size], className].filter(Boolean).join(' ');

  return (
    <span className={classes} role="img" aria-label={email}>
      {initialsFromEmail(email)}
    </span>
  );
}
