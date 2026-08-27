import { useEffect, useState } from 'react';

/**
 * Tracks a media query, and keeps tracking it.
 *
 * Used where a layout difference is structural rather than cosmetic — a diagram that has to
 * be rebuilt for narrow screens rather than restyled. Anything CSS can express should stay in
 * CSS; reaching for this to do a job a media query already does puts layout decisions in two
 * places that then disagree.
 *
 * Returns false when matchMedia is unavailable, so the wide layout is the fallback rather
 * than a narrow one rendered on a desktop.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    list.addEventListener('change', update);
    update();

    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}
