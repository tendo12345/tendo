import type { CSSProperties, ElementType, ReactNode } from 'react';
import { useParallax } from '../../hooks/useScrollMotion';

/*
  Depth through differential movement.

  §10 of the brief: elements in one composition should not share a single animation. Giving a
  heading, a diagram and a background slightly different travel is what reads as depth, and it
  does so without perspective transforms or tilt — which §24 rules out and which would fight
  the flat editorial surface anyway.

  Keep the numbers small. The brief asks for parallax the user feels rather than notices, and
  the difference between those two is roughly 40px of total travel. Past that it stops being
  depth and starts being a page that will not hold still.

  Movement is a `translate3d` on a CSS variable the driver writes, so it stays on the
  compositor and never triggers layout.
*/

interface ParallaxProps {
  children: ReactNode;
  /**
   * Full-strength travel in pixels across the element's whole pass through the viewport.
   * Negative drifts upward (moves against the scroll, reads as further away).
   * Scaled down on tablet and mobile and switched off entirely for reduced motion.
   */
  speed: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

export function Parallax({ children, speed, as: Tag = 'div', className = '', style }: ParallaxProps) {
  const ref = useParallax<HTMLElement>(speed);

  return (
    <Tag ref={ref} className={`app-parallax ${className}`.trim()} style={style}>
      {children}
    </Tag>
  );
}
