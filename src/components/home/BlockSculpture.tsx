import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { CENTRE, PIECES } from './logoPieces';
import type { Piece } from './logoPieces';
import styles from './BlockSculpture.module.css';

/*
  The Basis mark, built as a live object.

  The hero used to be a generic 3x3x3 lattice of identical cubes that only rhymed with the logo.
  It is now the logo itself: the same ten pieces as `brand/basis-logo-master.png` — the white
  core, the Lake Blue column, the periwinkle slab and block, gold, off-black, the coral and
  mint cylinders, the floating disc and the floating tile — in the same arrangement, so at
  rest the sculpture reads as the mark seen large.

  The motion is unchanged in kind: the pieces assemble on arrival, then the whole object
  gathers and loosens on one shared period while it turns a few degrees and leans toward the
  pointer. Gathered is the logo exactly; loosened is the logo coming apart along its own
  seams. That is the relationship the hero is for — a design system is these parts, fitted.

  Built with CSS 3D rather than WebGL: Three.js would add roughly 150 kB gzipped to the
  landing page, and ten bevelled solids with three visible faces each is the case CSS 3D
  handles well. The cost is the same too: no lighting
  model, so faces carry fixed tonal offsets and the movement stays small enough that fixed
  light still reads as light.

  This is a MODEL of the mark for motion, not the mark. Everywhere the logo appears as an
  identifier — nav, footer, favicon — it is the raster cut from the master by
  scripts/build-brand.py, and nothing here replaces that.

  The colours are sampled from the master and fixed, never theme tokens. The mark does not
  repaint itself per surface anywhere else, and a hero model of it that turned its core dark
  in dark mode would be a different logo.
*/

/**
 * How many circular slices build a disc's thickness.
 *
 * A cylinder in CSS 3D is a stack of discs, and the rim is only solid if the gaps between
 * slices stay under a pixel or two at the viewing angle. 34 per unit (about 3px apart) left the
 * cap's rim visibly striped — ridges, not a solid. 60 per unit keeps it under 2px at the
 * desktop unit, for 65 slices across all three discs.
 */
function sliceCount(thickness: number): number {
  return Math.max(8, Math.round(thickness * 60));
}

/** Arrival order follows the build: core first, then outward, so the mark assembles. */
function entranceDelay(i: number): number {
  return 420 + i * 55;
}

function Disc({ piece }: { piece: Piece }) {
  const thickness = piece.axis === 'x' ? piece.w : piece.axis === 'y' ? piece.h : piece.d;
  const count = sliceCount(thickness);
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        // -t/2 at the back, +t/2 at the face. The last slice is the visible face.
        const k = -thickness / 2 + (thickness * i) / (count - 1);
        const isFace = i === count - 1;
        return (
          <span
            key={i}
            className={`${styles.slice} ${styles[`axis${piece.axis!.toUpperCase()}`]} ${isFace ? styles.sliceFace : ''}`}
            style={{ '--k': k } as CSSProperties}
          />
        );
      })}
    </>
  );
}

export function BlockSculpture() {
  const reducedMotion = usePrefersReducedMotion();
  const finePointer = useMediaQuery('(pointer: fine)');
  const sceneRef = useRef<HTMLDivElement | null>(null);

  /*
    Pointer tilt.

    Writes two CSS variables and nothing else — no React state, so moving the mouse never
    re-renders. Capped at ±4° / ±3°: past that it stops reading as the object acknowledging
    you and starts reading as it chasing you.

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
            {PIECES.map((p, i) => (
              <div
                key={p.id}
                data-piece={p.id}
                className={`${styles.piece} ${styles[p.tone]} ${reducedMotion ? styles.pieceStill : ''}`}
                style={
                  {
                    '--x': p.x - CENTRE.x,
                    '--y': p.y - CENTRE.y,
                    '--z': p.z - CENTRE.z,
                    '--turn': `${p.turn ?? 0}deg`,
                    '--w': p.w,
                    '--h': p.h,
                    '--d': p.d,
                    '--fx': `${p.fx}px`,
                    '--fy': `${p.fy}px`,
                    '--fz': `${p.fz}px`,
                    '--rot': `${p.rot}deg`,
                    /* Negative delay so the cycle is already underway on first paint. */
                    '--drift-delay': `${-(p.group * 0.42).toFixed(2)}s`,
                    '--enter-delay': `${entranceDelay(i)}ms`,
                  } as CSSProperties
                }
              >
                {/* Assembly lives here, not on the piece: see .body in the stylesheet. */}
                <div className={styles.body}>
                  {p.shape === 'box' ? (
                    <>
                      <span className={`${styles.face} ${styles.front}`} />
                      <span className={`${styles.face} ${styles.top}`} />
                      <span className={`${styles.face} ${styles.side}`} />
                    </>
                  ) : (
                    <Disc piece={p} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
