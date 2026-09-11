/*
  The hero cube's mechanism, as pure math. No DOM, no React — cubeRig.ts drives the page with
  it, and cubeMechanics.test.ts proves it.

  It is a real 3x3x3 puzzle, not an animation that looks like one. Every cubie carries a grid
  position and an orientation; a twist turns the nine cubies in one layer through 90 degrees
  about the cube's own axis and then COMMITS — positions are permuted and orientations
  multiplied, exactly as a physical cube's would be. So which cubies belong to a layer changes
  after every move, which is the thing CSS keyframes cannot express and the reason this is
  driven from script.

  Coordinates are CSS's own: x right, y DOWN, z toward the viewer. Rotation matrices use the
  same convention as CSS rotateX/Y/Z, so a matrix built here and written as matrix3d() turns
  the same way the equivalent CSS function would.
*/

export type Vec3 = [number, number, number];
/** Row-major 3x3. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];
export type Axis = 0 | 1 | 2;
export type Tone = 'core' | 'blue' | 'peri' | 'gold' | 'ink' | 'coral' | 'mint';

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Rotation about a principal axis, CSS handedness. */
export function axisRotation(axis: Axis, radians: number): Mat3 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  if (axis === 0) return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 1) return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/** Rotation about an arbitrary unit axis (Rodrigues), CSS handedness — matches rotate3d(). */
export function rotationAbout(u: Vec3, radians: number): Mat3 {
  const [x, y, z] = u;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  const t = 1 - c;
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}

export function multiply(a: Mat3, b: Mat3): Mat3 {
  const out = new Array(9) as Mat3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return out;
}

export function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export function normalize(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

/**
 * A quarter turn, snapped to exact integers.
 *
 * Committed state is built only from these, never from the float matrices used mid-twist, so
 * positions stay in {-1, 0, 1} and orientations stay exact after any number of moves. A float
 * cos(90deg) is 6e-17, not 0, and thousands of commits would otherwise drift the grid.
 */
export function quarterTurn(axis: Axis, dir: 1 | -1): Mat3 {
  // `+ 0` turns Math.round's -0 into 0, so committed state holds clean integers.
  return axisRotation(axis, (dir * Math.PI) / 2).map((n) => Math.round(n) + 0) as Mat3;
}

/*
  The solved cube, coloured as the Basis mark.

  Seen from the resting pose — above, front and right — the three faces carry the mark's
  composition: periwinkle across the top with the Lake Blue cap at its centre and the white
  core at its front edge; the blue column down the middle of the front face with coral beside
  it, gold at the bottom left and off-black at the bottom right; mint and white on the right
  face. The mix across all 27 follows the mark's own proportions, periwinkle-led with small
  warm accents, and the hidden centre is white because it is the core.

  Indexed as TONES[y + 1][z + 1][x + 1]: top layer first, back row first, left to right.
*/
const TONES: Tone[][][] = [
  // y = -1, the top layer
  [
    ['peri', 'peri', 'peri'],
    ['peri', 'blue', 'peri'],
    ['peri', 'core', 'peri'],
  ],
  // y = 0
  [
    ['peri', 'core', 'mint'],
    ['coral', 'core', 'mint'],
    ['coral', 'blue', 'core'],
  ],
  // y = 1, the bottom layer
  [
    ['gold', 'ink', 'ink'],
    ['gold', 'blue', 'ink'],
    ['gold', 'blue', 'ink'],
  ],
];

export interface Cubie {
  id: number;
  home: Vec3;
  tone: Tone;
}

export interface CubieState {
  pos: Vec3;
  orient: Mat3;
}

/** Built in assembly order: top layer first, back to front, left to right. */
export const CUBIES: Cubie[] = (() => {
  const list: Cubie[] = [];
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      for (let x = -1; x <= 1; x++) {
        list.push({ id: list.length, home: [x, y, z], tone: TONES[y + 1][z + 1][x + 1] });
      }
    }
  }
  return list;
})();

export function solvedState(): CubieState[] {
  return CUBIES.map((c) => ({ pos: [...c.home] as Vec3, orient: [...IDENTITY] as Mat3 }));
}

export interface Move {
  axis: Axis;
  /** Which slice along the axis: -1, 0 or 1. y = -1 is the TOP layer, since y runs down. */
  layer: -1 | 0 | 1;
  dir: 1 | -1;
}

export function inLayer(state: CubieState, move: Move): boolean {
  return state.pos[move.axis] === move.layer;
}

/** Complete a move: the turned layer's cubies take their new places and orientations. */
export function commit(states: CubieState[], move: Move): CubieState[] {
  const q = quarterTurn(move.axis, move.dir);
  return states.map((s) =>
    inLayer(s, move)
      ? { pos: apply(q, s.pos).map((n) => Math.round(n) + 0) as Vec3, orient: multiply(q, s.orient).map((n) => n + 0) as Mat3 }
      : s,
  );
}

/*
  The choreography.

  Twelve quarter turns that scramble the cube and bring it home to solved — the mark's
  composition — without ever resetting visibly. It opens on the top layer, as the reference
  does.

  The obvious construction, a scramble followed by its exact inverse, has a flaw you can see:
  at the midpoint the last turn meets its own undo, and a layer goes out and straight back.
  The loop's wrap has the same seam. Both ends of the scramble are therefore PAIRS of turns on
  one axis — top and bottom, right and middle — and turns on parallel layers commute, so the
  inverse can take each pair in swapped order. The sequence still composes to identity, and no
  layer ever turns twice in a row, across the loop boundary included. cubeMechanics.test.ts
  proves both.
*/
const TOP: Move = { axis: 1, layer: -1, dir: 1 };
const BOTTOM: Move = { axis: 1, layer: 1, dir: -1 };
const LEFT: Move = { axis: 0, layer: -1, dir: -1 };
const FRONT: Move = { axis: 2, layer: 1, dir: 1 };
const RIGHT: Move = { axis: 0, layer: 1, dir: 1 };
const MIDDLE: Move = { axis: 0, layer: 0, dir: 1 };

const undo = (m: Move): Move => ({ ...m, dir: m.dir === 1 ? -1 : 1 });

export const SEQUENCE: Move[] = [
  TOP, BOTTOM, LEFT, FRONT, RIGHT, MIDDLE,
  undo(RIGHT), undo(MIDDLE), undo(FRONT), undo(LEFT), undo(TOP), undo(BOTTOM),
];

/*
  Timing, measured off the reference at 20fps: a twist takes about 0.9s, eased at both ends,
  and the next begins almost at once; the cube rests solved only briefly; the whole object
  tumbles throughout at roughly 35 degrees a second.
*/
export const TIMING = {
  /** Each cubie flies in over this long. */
  assemble: 850,
  /** Gap between successive cubies starting to assemble. */
  assembleStagger: 32,
  assembleDelay: 120,
  /** First twist begins here, once the cube has settled. */
  firstTwist: 2300,
  twist: 900,
  gap: 140,
  /** Solved rest at the end of each loop. */
  hold: 1600,
} as const;

const SLOT = TIMING.twist + TIMING.gap;
export const LOOP_MS = SEQUENCE.length * SLOT + TIMING.hold;

export interface Phase {
  /** Which pass through the sequence this is. -1 before twisting begins. */
  loop: number;
  /** How many moves of this loop are complete. */
  done: number;
  /** The move in progress, if any, and how far through it (0-1, eased). */
  active: { index: number; progress: number } | null;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function phaseAt(clock: number): Phase {
  if (clock < TIMING.firstTwist) return { loop: -1, done: 0, active: null };
  const since = clock - TIMING.firstTwist;
  const loop = Math.floor(since / LOOP_MS);
  const t = since - loop * LOOP_MS;
  const slot = Math.floor(t / SLOT);
  if (slot >= SEQUENCE.length) return { loop, done: SEQUENCE.length, active: null };
  const local = t - slot * SLOT;
  if (local >= TIMING.twist) return { loop, done: slot + 1, active: null };
  return { loop, done: slot, active: { index: slot, progress: easeInOutCubic(local / TIMING.twist) } };
}

/** 0 before a cubie starts assembling, 1 once it is in place. */
export function assemblyAt(clock: number, cubieIndex: number): number {
  const start = TIMING.assembleDelay + cubieIndex * TIMING.assembleStagger;
  const k = Math.min(1, Math.max(0, (clock - start) / TIMING.assemble));
  return easeOutCubic(k);
}

/** Grid pitch, in cubie edges. The seam between cubies is 5.5% of an edge, as in the reference. */
export const PITCH = 1.055;
/** How far beyond its place a cubie starts assembling, as a fraction of its distance out. */
export const ASSEMBLY_SPREAD = 0.6;

export interface CubieTransform {
  rot: Mat3;
  /** Translation in cubie edges; multiply by the edge in px to place it. */
  pos: Vec3;
  scale: number;
}

/**
 * Where a cubie is drawn, given its committed state and any twist in progress.
 *
 * A turning cubie is rotated about the CUBE's centre, not its own: its position and its
 * orientation are both carried by the layer's rotation. At progress 1 this equals the
 * committed result of the move exactly, which is what makes the handover seamless.
 */
export function cubieTransform(s: CubieState, move: Move | null, progress: number, assembled = 1): CubieTransform {
  // Cubies fly in from 60% beyond their place. 2.6x was tried first and flung the near ones,
  // magnified by perspective, past the stage and the viewport: a horizontal scrollbar flashed
  // on every load, which a check taken after assembly never saw.
  const spread = PITCH * (1 + ASSEMBLY_SPREAD * (1 - assembled));
  const scale = 0.6 + 0.4 * assembled;
  const base: Vec3 = [s.pos[0] * spread, s.pos[1] * spread, s.pos[2] * spread];
  if (!move || !inLayer(s, move) || progress <= 0) return { rot: s.orient, pos: base, scale };
  const r = axisRotation(move.axis, (move.dir * Math.PI * progress) / 2);
  return { rot: multiply(r, s.orient), pos: apply(r, base), scale };
}

/*
  The whole object's orientation.

  A tilt toward the viewer so the top reads, then a continuous tumble about an oblique axis —
  mostly vertical, leaning a little on both others so the cube never spins like a turntable —
  plus a slow nod. TUMBLE_START sets where the tumble begins: at clock 0 the cube sits at a
  three-quarter view, which is also the reduced-motion pose.
*/
export const POSE_TILT = (-22 * Math.PI) / 180;
export const TUMBLE_AXIS: Vec3 = normalize([0.32, 1, 0.18]);
export const TUMBLE_START = (-38 * Math.PI) / 180;
/** Radians per millisecond: 34 degrees a second, the reference's pace. */
export const TUMBLE_RATE = (34 * Math.PI) / 180 / 1000;
const NOD = (7 * Math.PI) / 180;
const NOD_PERIOD = 9000;

export function worldRotation(clock: number, tiltX = 0, tiltY = 0): Mat3 {
  const nod = axisRotation(0, NOD * Math.sin((2 * Math.PI * clock) / NOD_PERIOD));
  const tumble = rotationAbout(TUMBLE_AXIS, TUMBLE_START + TUMBLE_RATE * clock);
  const view = multiply(axisRotation(0, POSE_TILT + tiltX), axisRotation(1, tiltY));
  return multiply(view, multiply(nod, tumble));
}

/** A matrix3d() string. CSS lists the matrix column by column; px is the cubie edge. */
export function toMatrix3d(rot: Mat3, pos: Vec3 = [0, 0, 0], scale = 1, px = 1): string {
  const r = rot.map((n) => n * scale);
  const f = (n: number) => (Math.abs(n) < 1e-9 ? 0 : +n.toFixed(6));
  return `matrix3d(${[
    r[0], r[3], r[6], 0,
    r[1], r[4], r[7], 0,
    r[2], r[5], r[8], 0,
    pos[0] * px, pos[1] * px, pos[2] * px, 1,
  ].map(f).join(',')})`;
}

/*
  Lighting.

  Once a layer has turned, a cubie's "top" face can point anywhere, so tones baked per face —
  top lighter, side darker, as the old sculpture did — would leave one face of the cube
  patchwork. Every face is instead lit from its real direction each frame: a soft key light
  from the upper left and front, plus a tight highlight where a face turns to catch it, which
  is what reads as the reference's gloss.

  Faces are the six unit normals of a cube in cubie space, in the order the component renders
  them.
*/
export const FACES = ['front', 'back', 'right', 'left', 'top', 'bottom'] as const;
export type Face = (typeof FACES)[number];
export const FACE_NORMALS: Record<Face, Vec3> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  right: [1, 0, 0],
  left: [-1, 0, 0],
  top: [0, -1, 0],
  bottom: [0, 1, 0],
};

export const LIGHT: Vec3 = normalize([-0.45, -0.85, 0.55]);
const HALF: Vec3 = normalize([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
const AMBIENT = 0.7;
const DIFFUSE = 0.38;
const SPECULAR = 0.2;
const SHININESS = 28;

/** Sampled from brand/basis-logo-master.png, fixed in both themes like the mark itself. */
export const TONE_RGB: Record<Tone, Vec3> = {
  core: [248, 245, 243],
  blue: [43, 89, 209],
  peri: [180, 197, 247],
  gold: [236, 213, 146],
  ink: [44, 43, 46],
  coral: [249, 165, 130],
  mint: [154, 230, 192],
};

export interface Light {
  /** Diffuse intensity multiplier. */
  intensity: number;
  /** Highlight strength, 0-SPECULAR. */
  highlight: number;
}

export function lightFor(worldNormal: Vec3): Light {
  const d = Math.max(0, worldNormal[0] * LIGHT[0] + worldNormal[1] * LIGHT[1] + worldNormal[2] * LIGHT[2]);
  const h = Math.max(0, worldNormal[0] * HALF[0] + worldNormal[1] * HALF[1] + worldNormal[2] * HALF[2]);
  return { intensity: AMBIENT + DIFFUSE * d, highlight: SPECULAR * h ** SHININESS };
}

export function shade(tone: Tone, light: Light): string {
  const [r, g, b] = TONE_RGB[tone];
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n * light.intensity + 255 * light.highlight)));
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}
