import { describe, expect, it } from 'vitest';
import {
  CUBIES,
  FACES,
  FACE_NORMALS,
  IDENTITY,
  LOOP_MS,
  SEQUENCE,
  TIMING,
  apply,
  axisRotation,
  commit,
  cubieTransform,
  inLayer,
  lightFor,
  multiply,
  phaseAt,
  rotationAbout,
  shade,
  solvedState,
  toMatrix3d,
  worldRotation,
} from './cubeMechanics';
import type { CubieState, Mat3, Vec3 } from './cubeMechanics';

const close = (a: number[], b: number[], eps = 1e-9) => a.every((n, i) => Math.abs(n - b[i]) < eps);
const key = (v: Vec3) => v.join(',');

describe('the cube as a puzzle', () => {
  it('has 27 cubies, one per grid cell', () => {
    expect(CUBIES).toHaveLength(27);
    expect(new Set(CUBIES.map((c) => key(c.home))).size).toBe(27);
  });

  it('turns exactly nine cubies on every move of the sequence', () => {
    let states = solvedState();
    for (const move of SEQUENCE) {
      expect(states.filter((s) => inLayer(s, move))).toHaveLength(9);
      states = commit(states, move);
    }
  });

  /*
    The invariant a physical cube cannot break: after any number of turns, every cell is still
    occupied by exactly one cubie, every coordinate is still an integer in {-1, 0, 1}, and every
    orientation is still an exact rotation. Float drift or a wrong permutation fails here long
    before it would be visible as a cubie sliding off the grid.
  */
  it('keeps the grid whole after every move', () => {
    let states = solvedState();
    for (const move of SEQUENCE) {
      states = commit(states, move);
      expect(new Set(states.map((s) => key(s.pos))).size).toBe(27);
      for (const s of states) {
        for (const n of s.pos) expect([-1, 0, 1]).toContain(n);
        for (const n of s.orient) expect([-1, 0, 1]).toContain(n);
        // A rotation's transpose is its inverse.
        const t = [s.orient[0], s.orient[3], s.orient[6], s.orient[1], s.orient[4], s.orient[7], s.orient[2], s.orient[5], s.orient[8]] as Mat3;
        expect(multiply(s.orient, t)).toEqual(IDENTITY);
      }
    }
  });

  it('comes home to the solved cube at the end of every pass', () => {
    const end = SEQUENCE.reduce<CubieState[]>((states, move) => commit(states, move), solvedState());
    end.forEach((s, i) => {
      expect(s.pos, `cubie ${i}`).toEqual(CUBIES[i].home);
      expect(s.orient, `cubie ${i}`).toEqual(IDENTITY);
    });
  });

  it('actually scrambles on the way — a sequence of no-ops would also come home', () => {
    const half = SEQUENCE.slice(0, SEQUENCE.length / 2).reduce<CubieState[]>((s, m) => commit(s, m), solvedState());
    const displaced = half.filter((s, i) => key(s.pos) !== key(CUBIES[i].home)).length;
    expect(displaced).toBeGreaterThan(12);
  });

  /*
    A layer turned and then turned straight back reads as one fumbled move. A scramble followed
    by its plain inverse always does this at the midpoint — this test caught exactly that in
    the first version of the sequence — and the loop boundary is checked too, since the last
    move of one pass is followed by the first of the next.
  */
  it('never turns the same layer twice in a row, across the loop boundary included', () => {
    for (let i = 0; i < SEQUENCE.length; i++) {
      const a = SEQUENCE[i];
      const b = SEQUENCE[(i + 1) % SEQUENCE.length];
      expect(a.axis === b.axis && a.layer === b.layer, `moves ${i} and ${(i + 1) % SEQUENCE.length}`).toBe(false);
    }
  });
});

describe('the handover from twisting to committed', () => {
  /*
    The frame a twist ends and the frame after its commit must draw every cubie in the same
    place. If they differ by even a sign, the layer visibly snaps each move — the most
    noticeable way this could look wrong, and the easiest to introduce by composing the
    rotation on the wrong side.
  */
  it('draws a finished twist exactly where the committed state puts it', () => {
    let states = solvedState();
    for (const move of SEQUENCE) {
      const before = states.map((s) => cubieTransform(s, move, 1));
      states = commit(states, move);
      const after = states.map((s) => cubieTransform(s, null, 0));
      before.forEach((b, i) => {
        expect(close(b.pos, after[i].pos), `position of cubie ${i}`).toBe(true);
        expect(close(b.rot, after[i].rot), `orientation of cubie ${i}`).toBe(true);
      });
    }
  });

  it('turns in the direction CSS would for the same angle', () => {
    // A point on +x turned +90deg about y must land where rotateY(90deg) sends it: -z.
    expect(close(apply(axisRotation(1, Math.PI / 2), [1, 0, 0]), [0, 0, -1])).toBe(true);
    // rotate3d about (0,1,0) must agree with rotateY.
    expect(close(rotationAbout([0, 1, 0], 0.7), axisRotation(1, 0.7))).toBe(true);
  });

  it('writes matrix3d column by column, with the translation last', () => {
    const m = toMatrix3d(axisRotation(2, Math.PI / 2), [1, 2, 3], 1, 10);
    const values = m.slice('matrix3d('.length, -1).split(',').map(Number);
    // rotateZ(90deg) sends x to y: the first column is (0, 1, 0).
    expect(values.slice(0, 3)).toEqual([0, 1, 0]);
    expect(values.slice(12)).toEqual([10, 20, 30, 1]);
  });
});

describe('the timeline', () => {
  it('holds still until the cube has assembled', () => {
    const lastIn = TIMING.assembleDelay + (CUBIES.length - 1) * TIMING.assembleStagger + TIMING.assemble;
    expect(TIMING.firstTwist).toBeGreaterThan(lastIn);
    expect(phaseAt(TIMING.firstTwist - 1).active).toBeNull();
  });

  it('runs every move in order, one at a time, then rests solved', () => {
    const seen: number[] = [];
    let lastDone = 0;
    for (let t = TIMING.firstTwist; t < TIMING.firstTwist + LOOP_MS; t += 10) {
      const p = phaseAt(t);
      expect(p.done).toBeGreaterThanOrEqual(lastDone);
      lastDone = p.done;
      if (p.active && seen[seen.length - 1] !== p.active.index) seen.push(p.active.index);
    }
    expect(seen).toEqual(SEQUENCE.map((_, i) => i));
    expect(phaseAt(TIMING.firstTwist + LOOP_MS - 1)).toMatchObject({ done: SEQUENCE.length, active: null });
  });

  it('starts each pass from the top', () => {
    expect(phaseAt(TIMING.firstTwist + LOOP_MS)).toMatchObject({ loop: 1, done: 0 });
  });
});

describe('light and the resting pose', () => {
  const REST = worldRotation(0);
  const facing = (face: (typeof FACES)[number]) => apply(REST, FACE_NORMALS[face])[2];

  it('rests showing the top, front and right faces, as the mark is drawn', () => {
    expect(facing('top')).toBeGreaterThan(0.2);
    expect(facing('front')).toBeGreaterThan(0.2);
    expect(facing('right')).toBeGreaterThan(0.2);
    expect(facing('back')).toBeLessThan(0);
    expect(facing('left')).toBeLessThan(0);
    expect(facing('bottom')).toBeLessThan(0);
  });

  it('carries the mark’s composition on the front face when solved', () => {
    const front = (x: number, y: number) => CUBIES.find((c) => key(c.home) === key([x, y, 1]))!.tone;
    // The blue column down the middle, gold bottom left, off-black bottom right.
    expect([front(0, 0), front(0, 1)]).toEqual(['blue', 'blue']);
    expect(front(-1, 1)).toBe('gold');
    expect(front(1, 1)).toBe('ink');
  });

  it('lights a face toward the light more than one turned away', () => {
    const lit = lightFor([0, -1, 0]); // facing up, toward the key light
    const unlit = lightFor([0, 1, 0]); // facing down
    expect(lit.intensity).toBeGreaterThan(unlit.intensity);
  });

  it('always produces a valid colour, even at the brightest highlight', () => {
    for (const tone of new Set(CUBIES.map((c) => c.tone))) {
      for (const n of Object.values(FACE_NORMALS)) {
        const rgb = shade(tone, lightFor(apply(REST, n)));
        expect(rgb).toMatch(/^rgb\((\d{1,3}), (\d{1,3}), (\d{1,3})\)$/);
        for (const c of rgb.match(/\d+/g)!.map(Number)) expect(c).toBeLessThanOrEqual(255);
      }
    }
  });
});
