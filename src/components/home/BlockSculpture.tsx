import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import styles from './BlockSculpture.module.css';

/*
  A modular block sculpture, built with CSS 3D rather than WebGL.

  The brief allows either and says the result matters more than the technology. Three.js would
  add roughly 150 kB gzipped to a landing page this repo deliberately holds near 98 kB — the
  entire reason the dataset is lazily imported and the hero sample is precomputed. Twenty-odd
  beveled blocks with three faces each is exactly the case CSS 3D handles well: no textures,
  no shaders, no per-frame JS, and the compositor does the work.

  What that costs: no real lighting model. Faces get fixed tonal offsets — top lighter, front
  base, side darker — so the light does not travel across the object as it turns. At ±8° of
  rotation that reads as a solid form; it would fall apart under real rotation, which is one
  more reason the movement stays small.

  Nothing here is generated output. The palette is the APP's own (--app-*), so this cannot be
  mistaken for a system Basis produced, and it never touches --ds-*.
*/

interface Block {
  /** Lattice cell, each -1 | 0 | 1. */
  x: number;
  y: number;
  z: number;
  /** One of the sculpture's colour roles. */
  tone: 'ink' | 'paper' | 'ash' | 'blue' | 'peri' | 'sky' | 'mint' | 'coral' | 'gold';
  /** Drift offsets in px, and a small rotation. Kept per-block so nothing moves in unison. */
  fx: number;
  fy: number;
  fz: number;
  rot: number;
  /**
   * Phase group, 0-3. Every block shares ONE period and differs only by this offset.
   *
   * An earlier version gave each block its own 12-17s duration with delays spread over nine
   * seconds. Measured, the object's mean radius varied by 2px: at any instant some blocks were
   * compact and some separated, so they averaged out and the cube never changed state. The
   * whole point is a global gather-and-loosen, which only exists if they share a period.
   */
  group: 0 | 1 | 2 | 3;
}

/*
  The lattice.

  A 3x3x3 grid with eight cells left empty, which is what stops it reading as a solid box —
  the gaps are what make it a structure rather than a cube. The silhouette still resolves as
  cubic from any angle in the rotation range.

  Colour balance follows the brief: roughly two thirds neutral (ink / paper / ash), a quarter
  blue family, and a few warm accents. The accents are placed on outer cells so they catch the
  eye at the silhouette edge rather than being buried in the middle where they would only
  muddy the mass.
*/
const BLOCKS: Block[] = [
  { x: -1, y: -1, z: -1, tone: 'ink', fx: 0, fy: -10, fz: 4, rot: 1.5, group: 0 },
  { x: 0, y: -1, z: -1, tone: 'ash', fx: 5, fy: -6, fz: 0, rot: -1, group: 1 },
  { x: 1, y: -1, z: -1, tone: 'peri', fx: 8, fy: -12, fz: 6, rot: 2, group: 2 },
  { x: -1, y: -1, z: 0, tone: 'paper', fx: -6, fy: -8, fz: 0, rot: -1.5, group: 3 },
  { x: 1, y: -1, z: 0, tone: 'blue', fx: 6, fy: -14, fz: -4, rot: 1, group: 1 },
  { x: 0, y: -1, z: 1, tone: 'mint', fx: 0, fy: -9, fz: 10, rot: -2, group: 2 },
  { x: 1, y: -1, z: 1, tone: 'ink', fx: 10, fy: -7, fz: 8, rot: 1.5, group: 0 },

  { x: -1, y: 0, z: -1, tone: 'ash', fx: -8, fy: 4, fz: 0, rot: 1, group: 3 },
  { x: 0, y: 0, z: -1, tone: 'ink', fx: 0, fy: 6, fz: -6, rot: -1, group: 2 },
  { x: -1, y: 0, z: 0, tone: 'sky', fx: -10, fy: 0, fz: 4, rot: -1.5, group: 0 },
  { x: 1, y: 0, z: 0, tone: 'paper', fx: 9, fy: 5, fz: 0, rot: 2, group: 1 },
  { x: 0, y: 0, z: 1, tone: 'blue', fx: 0, fy: -5, fz: 12, rot: 1, group: 3 },
  { x: 1, y: 0, z: 1, tone: 'ash', fx: 7, fy: 8, fz: 6, rot: -2, group: 0 },
  { x: -1, y: 0, z: 1, tone: 'coral', fx: -7, fy: -6, fz: 9, rot: 1.5, group: 2 },

  { x: -1, y: 1, z: -1, tone: 'paper', fx: -5, fy: 10, fz: -4, rot: -1, group: 1 },
  { x: 0, y: 1, z: -1, tone: 'peri', fx: 0, fy: 12, fz: 0, rot: 1, group: 3 },
  { x: 1, y: 1, z: -1, tone: 'ink', fx: 6, fy: 9, fz: -5, rot: -1.5, group: 2 },
  { x: -1, y: 1, z: 0, tone: 'ink', fx: -9, fy: 7, fz: 0, rot: 2, group: 1 },
  { x: 0, y: 1, z: 0, tone: 'gold', fx: 0, fy: 14, fz: 5, rot: -1, group: 0 },
  { x: 1, y: 1, z: 0, tone: 'ash', fx: 8, fy: 6, fz: -6, rot: 1, group: 3 },
  { x: 0, y: 1, z: 1, tone: 'paper', fx: 0, fy: 11, fz: 8, rot: -2, group: 1 },
];

/** Entrance settles the blocks in lattice order, so the object assembles rather than appears. */
function entranceDelay(i: number): number {
  return 420 + Math.min(i * 26, 560);
}

export function BlockSculpture() {
  const reducedMotion = usePrefersReducedMotion();
  const finePointer = useMediaQuery('(pointer: fine)');
  const sceneRef = useRef<HTMLDivElement | null>(null);

  /*
    Pointer tilt.

    Writes two CSS variables and nothing else — no React state, so moving the mouse never
    re-renders. Capped at ±4° / ±3°: past that it stops reading as the object acknowledging
    you and starts reading as it chasing you, which the brief rules out.

    Never attached on touch or under reduced motion, so there is no listener to pay for on the
    devices that would not benefit.
  */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || reducedMotion || !finePointer) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = scene.getBoundingClientRect();
        const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        const clamp = (n: number) => Math.max(-1, Math.min(1, n));
        scene.style.setProperty('--tilt-y', `${(clamp(dx) * 4).toFixed(2)}deg`);
        scene.style.setProperty('--tilt-x', `${(clamp(dy) * -3).toFixed(2)}deg`);
      });
    };

    const onLeave = () => {
      scene.style.setProperty('--tilt-y', '0deg');
      scene.style.setProperty('--tilt-x', '0deg');
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reducedMotion, finePointer]);

  return (
    <div className={styles.stage} aria-hidden="true">
      {/* Atmospheric field, confined to this column. It never sits behind hero text, so it
          cannot affect any measured contrast pair — see the note in the stylesheet. */}
      <span className={styles.field} />

      <div ref={sceneRef} className={styles.scene}>
        {/*
          Entrance and continuous turn live on SEPARATE elements, and that is not tidiness.
          Both animate `transform`; when they shared one node the entrance's `both` fill-mode
          held its end state forever and the turn silently never ran. It computed cleanly and
          looked like a static object with no error anywhere.
        */}
        <div className={`${styles.entrance} ${reducedMotion ? styles.entranceStill : ''}`}>
          <div className={`${styles.lattice} ${reducedMotion ? styles.latticeStill : ''}`}>
          {BLOCKS.map((b, i) => (
            <div
              key={`${b.x}${b.y}${b.z}`}
              className={`${styles.block} ${styles[b.tone]} ${reducedMotion ? styles.blockStill : ''}`}
              style={
                {
                  '--x': b.x,
                  '--y': b.y,
                  '--z': b.z,
                  '--fx': `${b.fx}px`,
                  '--fy': `${b.fy}px`,
                  '--fz': `${b.fz}px`,
                  '--rot': `${b.rot}deg`,
                  /* Negative delay so the cycle is already underway on first paint. */
                  '--drift-delay': `${-(b.group * 0.42).toFixed(2)}s`,
                  '--enter-delay': `${entranceDelay(i)}ms`,
                } as CSSProperties
              }
            >
              <span className={`${styles.face} ${styles.front}`} />
              <span className={`${styles.face} ${styles.top}`} />
              <span className={`${styles.face} ${styles.side}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
