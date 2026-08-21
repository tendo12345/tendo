import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent';
type Size = 'md' | 'sm';

interface StyleProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

function useClasses({ variant = 'secondary', size = 'md', fullWidth, className = '' }: StyleProps) {
  return [styles.btn, styles[variant], size === 'sm' ? styles.sm : '', fullWidth ? styles.fullWidth : '', className]
    .filter(Boolean)
    .join(' ');
}

interface LinkProps extends StyleProps, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof StyleProps | 'href'> {
  href: string;
  external?: boolean;
}

interface ClickProps
  extends StyleProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof StyleProps | 'href'> {
  href?: undefined;
}

type ButtonProps = LinkProps | ClickProps;

export function Button(props: ButtonProps) {
  const { variant, size, fullWidth, className, children } = props;
  const classes = useClasses({ variant, size, fullWidth, className, children });

  if (props.href) {
    const { href, external, variant: _v, size: _s, fullWidth: _fw, className: _c, children: _ch, ...anchorRest } = props;
    if (external) {
      return (
        <a href={href} className={classes} target="_blank" rel="noreferrer" {...anchorRest}>
          {children}
        </a>
      );
    }
    return (
      <Link to={href} className={classes} {...anchorRest}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, fullWidth: _fw, className: _c, children: _ch, href: _h, ...buttonRest } = props as ClickProps;
  return (
    <button type="button" className={classes} {...buttonRest}>
      {children}
    </button>
  );
}
