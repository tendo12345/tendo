import type { ReactNode } from 'react';
import type { DesignSystemOutput } from '../../engine/types';
import { designSystemStyleVars } from '../../lib/designSystemVars';
import styles from './dsPreview.module.css';

interface DesignSystemScopeProps {
  output: DesignSystemOutput;
  children: ReactNode;
  className?: string;
}

/** Scopes `--ds-*` custom properties (and the shared preview styles) to everything inside it. */
export function DesignSystemScope({ output, children, className = '' }: DesignSystemScopeProps) {
  return (
    <div className={`${styles.scope} ${className}`} style={designSystemStyleVars(output)}>
      {children}
    </div>
  );
}
