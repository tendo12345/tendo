/*
  The ten pieces of the Basis mark, as a 3D model for the hero.

  Kept out of BlockSculpture.tsx so the geometry can be tested on its own — see
  logoPieces.test.ts, which fails if any two pieces intersect.
*/

export type Tone = 'core' | 'blue' | 'peri' | 'gold' | 'ink' | 'coral' | 'mint';

export interface Piece {
  /** Stable key, and the name used when a piece has to be discussed. */
  id: string;
  tone: Tone;
  /**
   * `box` is a bevelled cuboid. `disc` is a cylinder, and `axis` names the direction its flat
   * face points: `z` toward the viewer, `x` to the right, `y` up.
   */
  shape: 'box' | 'disc';
  axis?: 'x' | 'y' | 'z';
  /** Centre, in units of --unit. y runs DOWN, z runs toward the viewer — CSS's own axes. */
  x: number;
  y: number;
  z: number;
  /** Extent along each axis, in units. For a disc, the two axes across its face are equal. */
  w: number;
  h: number;
  d: number;
  /**
   * Degrees about the vertical axis, for a piece that faces the camera more squarely than the
   * rest. Only the column uses it: in the master its front is nearly head-on while everything
   * else sits at the three-quarter view.
   */
  turn?: number;
  /** Where the piece travels at the loosened end of the cycle, in px, plus a small turn. */
  fx: number;
  fy: number;
  fz: number;
  rot: number;
  /** Phase group, 0-3. One shared period; only the offset differs. See the stylesheet. */
  group: 0 | 1 | 2 | 3;
}

/*
  The mark's ten pieces, placed to match the master.

  Positions are SOLVED, not eyeballed. The master is a render from one camera — rotateX(-20)
  rotateY(-40), read off the slopes of its edges: the x-edges and z-edges fall at nearly the
  same angle, which only a near-isometric view produces. Given that camera, each piece's 2D
  centre in the master fixes two of its coordinates; depth was chosen from which pieces
  occlude which. Moving a piece by hand breaks that correspondence, and the resting pose stops
  reading as the logo long before it looks wrong in isolation.

  The axes therefore look odd in the numbers — the column sits at x 1.06, z 1.62 — because
  "front and left" in the master is "toward the camera", which at this pose is +z and -x.

  No two solids intersect, and that is a requirement rather than tidiness: CSS 3D depth-sorts
  whole planes and does not split one plane by another, so interpenetrating faces z-fight and
  flicker as the object turns. Neighbours keep a hairline of air instead, which the bevels
  hide at rest.

  Loosening pushes each piece outward from the core along the direction it already sits in,
  so the object comes apart along its own seams instead of pieces wandering at random. The
  core barely moves; it is what everything else is fitted to.
*/
export const PIECES: Piece[] = [
  { id: 'core', tone: 'core', shape: 'box', x: 0, y: 0, z: 0, w: 1, h: 1, d: 1, fx: 0, fy: -4, fz: 0, rot: 0, group: 0 },
  { id: 'slab', tone: 'peri', shape: 'box', x: -1.27, y: 0.12, z: 0.08, w: 0.8, h: 0.8, d: 1.7, fx: -22, fy: 2, fz: 1, rot: -1.5, group: 1 },
  { id: 'block', tone: 'peri', shape: 'box', x: 0.05, y: -0.04, z: -1.11, w: 0.95, h: 0.85, d: 0.85, fx: 1, fy: -1, fz: -22, rot: 2, group: 2 },
  { id: 'column', tone: 'blue', shape: 'box', x: 1.06, y: 0.45, z: 1.62, w: 0.95, h: 1.25, d: 0.6, turn: 30, fx: 12, fy: 5, fz: 18, rot: -1, group: 3 },
  { id: 'gold', tone: 'gold', shape: 'box', x: -0.3, y: 1.0, z: 1.49, w: 0.95, h: 0.95, d: 0.95, fx: -4, fy: 12, fz: 18, rot: 1.5, group: 2 },
  { id: 'ink', tone: 'ink', shape: 'box', x: 1.38, y: 1.02, z: 0.57, w: 0.95, h: 0.85, d: 0.95, fx: 17, fy: 12, fz: 7, rot: -2, group: 1 },
  { id: 'coral', tone: 'coral', shape: 'disc', axis: 'z', x: 0.12, y: -0.04, z: 1.62, w: 0.66, h: 0.66, d: 0.6, fx: 2, fy: -1, fz: 22, rot: 0, group: 0 },
  { id: 'mint', tone: 'mint', shape: 'disc', axis: 'x', x: 1.71, y: 0.06, z: 0.4, w: 0.26, h: 0.76, d: 0.76, fx: 21, fy: 1, fz: 5, rot: 0, group: 3 },
  { id: 'cap', tone: 'blue', shape: 'disc', axis: 'y', x: -0.37, y: -0.97, z: -0.57, w: 0.56, h: 0.22, d: 0.56, fx: -7, fy: -18, fz: -11, rot: 0, group: 1 },
  { id: 'tile', tone: 'peri', shape: 'box', x: 1.47, y: 1.31, z: 2.03, w: 0.85, h: 0.16, d: 0.7, fx: 11, fy: 10, fz: 16, rot: 1, group: 0 },
];

/*
  The point the object turns about.

  The pieces are placed around the white core, but the mark's mass is not centred on it — most
  of it sits in front of and below the core. Turning about the core swung the whole object
  through a wide arc and parked it high in the stage. This is the mean of the pieces'
  positions, subtracted from each, so the turn pivots on the middle of the mark.
*/
export const CENTRE = { x: 0.39, y: 0.29, z: 0.61 };
