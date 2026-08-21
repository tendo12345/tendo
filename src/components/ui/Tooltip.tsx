import { useId } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  text: string;
}

/** A small "?" affordance that reveals a definition on hover/focus — used for jargon like "design tokens". */
export function Tooltip({ text }: TooltipProps) {
  const id = useId();

  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.trigger} aria-describedby={id}>
        ?
      </button>
      <span role="tooltip" id={id} className={styles.bubble}>
        {text}
      </span>
    </span>
  );
}
