import type { CSSProperties, ElementType, ReactNode } from 'react';
import { useInView } from '../../hooks/useInView';

/*
  Scroll reveal, with the failure mode designed out.

  The obvious implementation gives the element `opacity: 0` and waits for a class to reveal
  it. That has a way of destroying a page: if the observer never fires — no
  IntersectionObserver, a hydration slip, a layout where the element never intersects — the
  content stays invisible permanently, and nothing about the failure looks like a failure.

  So the resting state here is VISIBLE. Arriving in view *adds* an animation whose keyframes
  start from hidden and fill `both`, which produces the same effect on screen while
  guaranteeing that every path where the JS does not run ends with readable content. The
  reduced-motion backstop in reset.css collapses the animation, landing on the same place.

  §14 of the brief: reveal major headings and statements, not every paragraph. Use this
  deliberately — body copy should stay still.
*/

type RevealVariant = 'rise' | 'clip';

interface RevealProps {
  children: ReactNode;
  /** Element to render. Defaults to a div. */
  as?: ElementType;
  /**
   * `rise` — 8px lift and fade, for blocks and cards.
   * `clip` — wipes upward from its own baseline, for large serif headings. §13 asks for
   *   headings to feel *revealed* rather than moved, which a clip does and a translate cannot.
   */
  variant?: RevealVariant;
  /** Milliseconds to hold before starting, for hand-tuned ordering within a composition. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

export function Reveal({
  children,
  as: Tag = 'div',
  variant = 'rise',
  delay = 0,
  className = '',
  style,
}: RevealProps) {
  const { ref, inView } = useInView<HTMLElement>();

  const animationClass = inView ? (variant === 'clip' ? 'app-clip-in' : 'app-enter') : '';

  return (
    <Tag
      ref={ref}
      className={`${className} ${animationClass}`.trim()}
      style={delay ? ({ ...style, '--app-enter-delay': `${delay}ms` } as CSSProperties) : style}
    >
      {children}
    </Tag>
  );
}
