import type { ReactNode } from 'react';
import type { ModePalette } from '../../engine/darkMode';
import type { DesignSystemOutput } from '../../engine/types';
import { designSystemStyleVars, designSystemStyleVarsForMode } from '../../lib/designSystemVars';
import styles from './dsPreview.module.css';

interface DesignSystemScopeProps {
  output: DesignSystemOutput;
  children: ReactNode;
  className?: string;
  /** Overrides colour vars with this mode's palette instead of `output.colors` directly. */
  mode?: ModePalette;
}

/** Scopes `--ds-*` custom properties (and the shared preview styles) to everything inside it. */
export function DesignSystemScope({ output, children, className = '', mode }: DesignSystemScopeProps) {
  const vars = mode ? designSystemStyleVarsForMode(output, mode) : designSystemStyleVars(output);
  return (
    <div className={`${styles.scope} ${className}`} style={vars}>
      {children}
    </div>
  );
}
