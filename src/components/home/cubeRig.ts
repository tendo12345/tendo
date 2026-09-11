import {
  CUBIES,
  FACES,
  FACE_NORMALS,
  SEQUENCE,
  TIMING,
  apply,
  assemblyAt,
  commit,
  cubieTransform,
  lightFor,
  multiply,
  phaseAt,
  shade,
  solvedState,
  toMatrix3d,
  worldRotation,
} from './cubeMechanics';
import type { CubieState, Mat3 } from './cubeMechanics';

/*
  Drives the hero cube from one requestAnimationFrame loop.

  It writes transforms and colours straight to the elements and never touches React state, so
  a frame costs no render. Three things keep that cheap:

  - A cubie's transform is written only while it is moving — assembling, or in the layer that
    is turning. The tumble lives on the cube's own element, so a still cubie needs nothing.
  - A face's colour is written only when its lighting moves by a visible step, and faces
    turned away from the viewer are skipped until they come back round.
  - The loop stops entirely while the stage is off screen. requestAnimationFrame already
    pauses in a background tab; the clock advances by at most 50ms a frame, so returning
    resumes where it left off instead of fast-forwarding through missed twists.
*/

export interface RigElements {
  stage: HTMLElement;
  cube: HTMLElement;
  cubies: HTMLElement[];
  /** 27 x 6, in CUBIES order and FACES order within each. */
  faces: HTMLElement[];
}

export interface RigOptions {
  /** Lean toward the pointer. Off for touch. */
  followPointer: boolean;
}

const MAX_STEP = 50;
/** A face is re-coloured when its light moves by 1/80th of the range — below what reads. */
const LIGHT_STEPS = 80;
/**
 * Faces whose normal points this far away are culled by `backface-visibility` and not worth
 * lighting. Slightly past edge-on rather than at it, because perspective shows a face a
 * little beyond the orthographic horizon.
 */
const VISIBLE_Z = -0.35;

export function startCubeRig(el: RigElements, options: RigOptions): () => void {
  let unit = readUnit(el.stage);
  let clock = 0;
  let last = 0;
  let frame = 0;
  let visible = true;

  let loop = -1;
  let done = 0;
  let states: CubieState[] = solvedState();
  const lastKey = new Int32Array(el.faces.length).fill(-1);
  let assembling = true;

  // Pointer lean, eased toward its target each frame rather than set, so it glides.
  let tiltX = 0;
  let tiltY = 0;
  let targetX = 0;
  let targetY = 0;

  const writeCubie = (i: number, move: (typeof SEQUENCE)[number] | null, progress: number) => {
    const t = cubieTransform(states[i], move, progress, assemblyAt(clock, i));
    el.cubies[i].style.transform = toMatrix3d(t.rot, t.pos, t.scale, unit);
    return t.rot;
  };

  const tick = (now: number) => {
    frame = 0;
    const dt = last ? Math.min(MAX_STEP, now - last) : 0;
    last = now;
    clock += dt;

    tiltX += (targetX - tiltX) * 0.08;
    tiltY += (targetY - tiltY) * 0.08;
    const world = worldRotation(clock, tiltX, tiltY);
    el.cube.style.transform = toMatrix3d(world);

    // Advance the puzzle: start each loop from solved, and commit every move that finished.
    const phase = phaseAt(clock);
    if (phase.loop !== loop) {
      loop = phase.loop;
      done = 0;
      states = solvedState();
    }
    const committed = new Set<number>();
    while (done < phase.done) {
      const move = SEQUENCE[done];
      for (let i = 0; i < states.length; i++) if (states[i].pos[move.axis] === move.layer) committed.add(i);
      states = commit(states, move);
      done++;
    }

    const move = phase.active ? SEQUENCE[phase.active.index] : null;
    const progress = phase.active ? phase.active.progress : 0;
    const stillAssembling = clock < TIMING.assembleDelay + CUBIES.length * TIMING.assembleStagger + TIMING.assemble;

    for (let i = 0; i < CUBIES.length; i++) {
      const turning = move !== null && states[i].pos[move.axis] === move.layer;
      // Rotation of this cubie in cube space, for lighting — written or not.
      const rot: Mat3 =
        assembling || turning || committed.has(i)
          ? writeCubie(i, move, progress)
          : cubieTransform(states[i], null, 0).rot;

      const toView = multiply(world, rot);
      for (let f = 0; f < FACES.length; f++) {
        const n = apply(toView, FACE_NORMALS[FACES[f]]);
        if (n[2] < VISIBLE_Z) continue;
        const light = lightFor(n);
        const key = Math.round(light.intensity * LIGHT_STEPS) * 1000 + Math.round(light.highlight * LIGHT_STEPS * 4);
        const slot = i * FACES.length + f;
        if (key === lastKey[slot]) continue;
        lastKey[slot] = key;
        el.faces[slot].style.backgroundColor = shade(CUBIES[i].tone, light);
      }
    }
    assembling = stillAssembling;

    if (visible) frame = requestAnimationFrame(tick);
  };

  const start = () => {
    if (frame || !visible) return;
    last = 0;
    frame = requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
    else if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });
  io.observe(el.stage);

  // The edge length comes from CSS (--unit), which changes at breakpoints.
  const ro = new ResizeObserver(() => {
    const next = readUnit(el.stage);
    if (next === unit) return;
    unit = next;
    // Every cubie's translation is in px, so all of them move when the unit does.
    for (let i = 0; i < CUBIES.length; i++) writeCubie(i, null, 0);
  });
  ro.observe(el.stage);

  const onMove = (event: PointerEvent) => {
    const rect = el.stage.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const clamp = (n: number) => Math.max(-1, Math.min(1, n));
    // ±4° and ±3°: enough to read as the object noticing you, not chasing you.
    targetY = (clamp(dx) * 4 * Math.PI) / 180;
    targetX = (clamp(dy) * -3 * Math.PI) / 180;
  };
  const onLeave = () => {
    targetX = 0;
    targetY = 0;
  };
  if (options.followPointer) {
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
  }

  start();

  return () => {
    if (frame) cancelAnimationFrame(frame);
    io.disconnect();
    ro.disconnect();
    window.removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('pointerleave', onLeave);
  };
}

function readUnit(stage: HTMLElement): number {
  return parseFloat(getComputedStyle(stage).getPropertyValue('--unit')) || 80;
}
