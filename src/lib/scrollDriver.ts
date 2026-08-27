/*
  One scroll listener and one rAF loop for the whole application.

  Every scroll-linked effect in Basis registers here instead of attaching its own listener.
  That is a requirement rather than a tidiness preference: a dozen components each measuring
  layout on scroll is a dozen forced reflows per frame, and the cost lands exactly when the
  user is moving and least able to tolerate jank.

  The second, less obvious rule: **this never sets React state.** A subscriber receives a
  progress number and writes it to a CSS custom property on its own element. Animation then
  happens entirely in CSS, off the main thread where possible. Routing per-frame scroll
  progress through useState would re-render a subtree sixty times a second to move something
  eight pixels, which is how "smooth scroll animation" becomes a stutter.

  Measurement is batched: all reads happen together at the top of the frame, all writes after,
  so a subscriber cannot interleave them and thrash layout.
*/

/** Progress of an element through the viewport: 0 as it enters, 1 as it leaves. */
export type ProgressWriter = (progress: number, el: HTMLElement) => void;

interface Subscriber {
  el: HTMLElement;
  write: ProgressWriter;
  /** Cached last value, so we skip writes that would not change anything. */
  last: number;
}

const subscribers = new Set<Subscriber>();
let frame = 0;
let listening = false;

/** Clamp to 0..1. Scroll positions overshoot at both ends, especially with rubber-banding. */
function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * How far this element has travelled through the viewport.
 *
 * 0 when its top edge is at the bottom of the viewport, 1 when its bottom edge reaches the
 * top. Normalised against travel distance rather than raw scroll offset, so the value is
 * independent of scroll speed and of how the user got here — a jump to an anchor or a
 * scrollbar drag lands on the correct progress rather than animating through it.
 */
function progressOf(el: HTMLElement, viewportH: number): number {
  const rect = el.getBoundingClientRect();
  const travel = rect.height + viewportH;
  if (travel <= 0) return 0;
  return clamp01((viewportH - rect.top) / travel);
}

function tick(): void {
  frame = 0;
  if (subscribers.size === 0) return;

  const viewportH = window.innerHeight || 1;

  // Read phase — every measurement together, before any write.
  const measured: Array<{ sub: Subscriber; progress: number }> = [];
  for (const sub of subscribers) {
    measured.push({ sub, progress: progressOf(sub.el, viewportH) });
  }

  // Write phase.
  for (const { sub, progress } of measured) {
    // Sub-pixel changes are invisible and still cost a style recalc.
    if (Math.abs(progress - sub.last) < 0.001) continue;
    sub.last = progress;
    sub.write(progress, sub.el);
  }
}

function schedule(): void {
  if (frame) return;
  frame = requestAnimationFrame(tick);
}

function startListening(): void {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
}

function stopListening(): void {
  if (!listening) return;
  listening = false;
  window.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
  if (frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}

/**
 * Register an element for scroll progress. Returns an unsubscribe function.
 *
 * The writer is called once immediately so the element is in its correct state on mount
 * rather than snapping into place on the first scroll event — which matters for anything
 * already on screen at load, and for a deep link that lands mid-page.
 */
export function observeProgress(el: HTMLElement, write: ProgressWriter): () => void {
  const sub: Subscriber = { el, write, last: -1 };
  subscribers.add(sub);
  startListening();

  // Initial placement, measured immediately rather than waiting for a frame.
  write(progressOf(el, window.innerHeight || 1), el);
  sub.last = progressOf(el, window.innerHeight || 1);

  return () => {
    subscribers.delete(sub);
    if (subscribers.size === 0) stopListening();
  };
}

/** Exposed for tests: how many effects are currently driven. */
export function activeSubscriberCount(): number {
  return subscribers.size;
}
