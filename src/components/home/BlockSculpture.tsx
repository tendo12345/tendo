import { useEffect, useRef } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { CUBIES, FACES, FACE_NORMALS, PITCH, apply, lightFor, shade, toMatrix3d, worldRotation } from './cubeMechanics';
import { startCubeRig } from './cubeRig';
import styles from './BlockSculpture.module.css';

/*
  The hero cube: a working 3x3x3 puzzle in the Basis mark's colours.

  Built to the reference's behaviour: the whole cube tumbles continuously while one layer at a
  time twists through a quarter turn, the twists following each other almost without pause,
  and the cube comes back to solved between passes. Solved, its three visible faces carry the
  mark's composition — see TONES in cubeMechanics.ts.

  It is a mechanism, not a picture of one. Cubies really change places: each twist commits a
  permutation, so the nine cubies in a layer are different ones every move. That is why it is
  driven by script (cubeRig.ts) rather than keyframes, and why every face is lit from its real
  direction each frame instead of carrying a baked tone.

  Why CSS 3D rather than WebGL: 27 cubies of six faces is well within what the compositor
  handles, and Three.js would add about 150 kB gzipped to the landing page for it.

  First paint is the solved cube at its resting pose, lit correctly, before any script runs.
  Under reduced motion that is all there is: no loop, no pointer listener, nothing moves.
*/

/** The resting pose's orientation, used for first paint and as the reduced-motion state. */
const REST = worldRotation(0);

function restingColour(cubie: (typeof CUBIES)[number], face: (typeof FACES)[number]): string {
  return shade(cubie.tone, lightFor(apply(REST, FACE_NORMALS[face])));
}

export function BlockSculpture() {
  const reducedMotion = usePrefersReducedMotion();
  const finePointer = useMediaQuery('(pointer: fine)');
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cubeRef = useRef<HTMLDivElement | null>(null);
  const cubieRefs = useRef<HTMLDivElement[]>([]);
  const faceRefs = useRef<HTMLSpanElement[]>([]);

  useEffect(() => {
    const stage = stageRef.current;
    const cube = cubeRef.current;
    if (!stage || !cube || reducedMotion) return;
    return startCubeRig(
      { stage, cube, cubies: cubieRefs.current, faces: faceRefs.current },
      { followPointer: finePointer },
    );
  }, [reducedMotion, finePointer]);

  return (
    <div ref={stageRef} className={styles.stage} aria-hidden="true">
      {/* Atmospheric field, confined to this column. It never sits behind hero text, so it
          cannot affect any measured contrast pair — see the note in the stylesheet. */}
      <span className={styles.field} />

      <div className={styles.scene}>
        <div ref={cubeRef} className={styles.cube} style={{ transform: toMatrix3d(REST) }}>
          {CUBIES.map((cubie, i) => (
            <div
              key={cubie.id}
              ref={(node) => {
                if (node) cubieRefs.current[i] = node;
              }}
              className={styles.cubie}
              style={{
                /* Placed in CSS units until the rig takes over and writes px matrices. */
                transform: `translate3d(${cubie.home
                  .map((n) => `calc(${n * PITCH} * var(--unit))`)
                  .join(', ')})`,
              }}
            >
              {FACES.map((face, f) => (
                <span
                  key={face}
                  ref={(node) => {
                    if (node) faceRefs.current[i * FACES.length + f] = node;
                  }}
                  className={`${styles.face} ${styles[face]}`}
                  style={{ backgroundColor: restingColour(cubie, face) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
