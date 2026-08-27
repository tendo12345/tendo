import { Children, cloneElement, isValidElement } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { useInView } from '../../hooks/useInView';

/*
  Staggered entrance for a group of siblings.

  Each child gets the reveal class plus an incrementing delay, so a composition resolves in
  reading order instead of arriving as one block. The whole group shares ONE observer — the
  brief is explicit that this must not become hundreds of independent observers, and a card
  grid is exactly where that would happen if each item watched itself.

  The cap matters more than the step. Without it a twelve-item grid on a 90ms step makes the
  last card wait a full second, and the user is left watching furniture arrive. Anything past
  the cap enters together, which is invisible in practice and keeps the section usable.
*/

interface StaggerProps {
  children: ReactNode;
  /**
   * `enter` — 8px rise and fade, for text blocks and simple groups.
   * `compose` — travel, hairline scale and a clip, for cards and surfaces.
   */
  variant?: 'enter' | 'compose';
  /** Milliseconds between successive children. */
  step?: number;
  /** Delay before the first child. */
  initialDelay?: number;
  /** Longest delay any child may receive, however many there are. */
  maxDelay?: number;
  className?: string;
}

export function Stagger({
  children,
  variant = 'enter',
  step = 70,
  initialDelay = 0,
  maxDelay = 400,
  className = '',
}: StaggerProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const animationClass = variant === 'compose' ? 'app-compose' : 'app-enter';

  return (
    <div ref={ref} className={className}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;

        const delay = Math.min(initialDelay + i * step, maxDelay);
        const el = child as ReactElement<{ className?: string; style?: CSSProperties }>;

        return cloneElement(el, {
          className: `${el.props.className ?? ''} ${inView ? animationClass : ''}`.trim(),
          style: { ...el.props.style, '--app-enter-delay': `${delay}ms` } as CSSProperties,
        });
      })}
    </div>
  );
}
