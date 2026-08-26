import { useEffect, useRef, useState } from 'react';

/**
 * True once the element has been scrolled into view, and true forever after.
 *
 * Reveals are one-way on purpose: an element that fades back out when it leaves the viewport
 * turns scrolling into a flicker, and re-reading a page you already scrolled past should not
 * re-animate. Once seen, it stays seen — which is also why the observer disconnects itself.
 *
 * Nothing here needs a reduced-motion branch. The class this drives only sets an animation,
 * and the universal backstop in reset.css collapses that to nothing — the element is still
 * marked visible, so content is never withheld from anyone.
 *
 * If IntersectionObserver is unavailable the hook reports visible immediately, so the page
 * degrades to "everything is simply there" rather than to a blank column. That matters more
 * than it looks: a reveal that depends on JS is a reveal that can hide your content forever.
 */
export function useInView<T extends HTMLElement>(rootMargin = '0px 0px -10% 0px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin, threshold: 0.05 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}
