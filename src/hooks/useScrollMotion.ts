import { useEffect, useRef, useState } from 'react';
import { observeProgress } from '../lib/scrollDriver';

/*
  Scroll-linked motion, expressed as one number.

  Rather than branching on device at every call site — `if (mobile) distance = 8 else 24` —
  every effect declares its full-strength value and multiplies by a single scale. Desktop gets
  the whole composition, tablet half, mobile a quarter, and reduced-motion zero, which
  collapses every parallax and stagger to its resting state without a second code path to keep
  in sync.

  Zero is the important case: it is not "a smaller animation", it is the element sitting at
  its final position from the first frame. Nothing is withheld and nothing moves.
*/

const MOBILE = '(max-width: 767px)';
const TABLET = '(max-width: 1023px)';
const REDUCED = '(prefers-reduced-motion: reduce)';

function currentScale(): number {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 0;
  if (window.matchMedia(REDUCED).matches) return 0;
  if (window.matchMedia(MOBILE).matches) return 0.25;
  if (window.matchMedia(TABLET).matches) return 0.5;
  return 1;
}

/**
 * How much scroll choreography this viewport should get: 0, 0.25, 0.5 or 1.
 *
 * Re-evaluated when the queries change, so rotating a tablet or toggling the OS motion
 * setting takes effect without a reload.
 */
export function useMotionScale(): number {
  const [scale, setScale] = useState(currentScale);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const queries = [REDUCED, MOBILE, TABLET].map((q) => window.matchMedia(q));
    const update = () => setScale(currentScale());
    for (const q of queries) q.addEventListener('change', update);
    update();

    return () => {
      for (const q of queries) q.removeEventListener('change', update);
    };
  }, []);

  return scale;
}

/**
 * Writes this element's viewport progress (0 → 1) to a CSS custom property.
 *
 * The value lands as `--progress` and drives interpolation in CSS. Nothing re-renders: the
 * driver writes straight to the node, which is the whole point of routing scroll through it
 * rather than through React state.
 *
 * At scale 0 the property is pinned to its resting value and the element never registers, so
 * a reduced-motion user costs nothing at all — no listener, no frame, no measurement.
 */
export function useSectionProgress<T extends HTMLElement>(
  restingValue = 1,
  onProgress?: (progress: number) => void,
) {
  const ref = useRef<T | null>(null);
  const scale = useMotionScale();

  // Held in a ref so a caller passing an inline arrow does not re-subscribe every render.
  const callbackRef = useRef(onProgress);
  callbackRef.current = onProgress;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (scale === 0) {
      el.style.setProperty('--progress', String(restingValue));
      // Still report the resting value, so a consumer deriving discrete state from progress
      // lands on its final stage rather than staying stuck at whatever it initialised to.
      callbackRef.current?.(restingValue);
      return;
    }

    return observeProgress(el, (progress, node) => {
      node.style.setProperty('--progress', progress.toFixed(4));
      callbackRef.current?.(progress);
    });
  }, [scale, restingValue]);

  return ref;
}

/**
 * Moves an element against the scroll at a fraction of normal speed.
 *
 * `speed` is the full-strength offset in pixels across the element's whole travel through the
 * viewport; the real distance is that times the viewport's motion scale. Positive drifts
 * down, negative up.
 *
 * Deliberately capped by the caller rather than tied to raw scroll velocity: a flick or a
 * scrollbar drag produces the same positions as a slow scroll, just reached sooner. Velocity-
 * linked motion is what makes a page feel like it is sliding around underneath you.
 */
export function useParallax<T extends HTMLElement>(speed: number) {
  const ref = useRef<T | null>(null);
  const scale = useMotionScale();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (scale === 0) {
      el.style.setProperty('--parallax-y', '0px');
      return;
    }

    const distance = speed * scale;
    return observeProgress(el, (progress, node) => {
      // Centre the travel on the element's midpoint so it sits at its designed position when
      // it is in the middle of the viewport, drifting equally either side of that.
      const offset = (progress - 0.5) * distance;
      node.style.setProperty('--parallax-y', `${offset.toFixed(2)}px`);
    });
  }, [speed, scale]);

  return ref;
}
