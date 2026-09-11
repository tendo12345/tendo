import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PIECES } from './logoPieces';
import type { Piece } from './logoPieces';

/*
  Two failures in the hero's 3D mark are invisible to every check except a rendered frame.
  Computed style reports them as correct, and freezing the animation for a screenshot hides
  the first one. So both are asserted here, from the source.
*/

/** Axis-aligned extent of a piece, widened for its turn about the vertical axis. */
function extent(p: Piece) {
  const t = ((p.turn ?? 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  return {
    x: p.w * c + p.d * s,
    y: p.h,
    z: p.w * s + p.d * c,
  };
}

describe('the mark as a 3D model', () => {
  it('has the master’s ten pieces', () => {
    expect(PIECES.map((p) => p.id).sort()).toEqual(
      ['block', 'cap', 'column', 'coral', 'core', 'gold', 'ink', 'mint', 'slab', 'tile'].sort(),
    );
  });

  /*
    CSS 3D depth-sorts whole planes and never splits one by another, so two solids that
    interpenetrate z-fight: their faces flicker in and out as the object turns. Nothing in the
    DOM reports it. A hand-nudged piece is the likely cause, which is why this checks every
    pair rather than trusting the solver that placed them.
  */
  it('never lets two pieces intersect', () => {
    const AIR = 0.02;
    const clashes: string[] = [];
    for (let i = 0; i < PIECES.length; i++) {
      for (let j = i + 1; j < PIECES.length; j++) {
        const a = PIECES[i];
        const b = PIECES[j];
        const ea = extent(a);
        const eb = extent(b);
        const separated = (['x', 'y', 'z'] as const).some(
          (axis) => Math.abs(a[axis] - b[axis]) - (ea[axis] + eb[axis]) / 2 >= AIR,
        );
        if (!separated) clashes.push(`${a.id} / ${b.id}`);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('names a disc’s axis, and only a disc’s', () => {
    for (const p of PIECES) {
      if (p.shape === 'disc') expect(p.axis, p.id).toBeDefined();
      else expect(p.axis, p.id).toBeUndefined();
    }
  });
});

describe('the 3D chain carries no grouping property', () => {
  // Comments stripped first: this file's prose names the banned properties and the chain's
  // classes, and a rule parser reading comment text as a selector would flag its own warnings.
  const CSS = readFileSync(join(process.cwd(), 'src', 'components', 'home', 'BlockSculpture.module.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );

  /*
    The bug this guards shipped twice. Chromium treats an active opacity animation as a
    grouping property — and a `both` fill keeps it active forever, even at opacity 1 — which
    forces `transform-style: flat` on that element. On the entrance it flattened the whole
    object into one sheared card; on each piece it collapsed every box to a single face.

    Opacity is allowed in exactly one place: the scene, the root of the 3D context, where
    flattening has nothing left to flatten.
  */
  it('animates opacity only in the scene fade', () => {
    const keyframes = [...CSS.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)];
    expect(keyframes.length, 'no keyframes parsed — the scan is checking nothing').toBeGreaterThan(3);
    const withOpacity = keyframes.filter(([, , body]) => /\bopacity\s*:/.test(body)).map(([, name]) => name);
    expect(withOpacity).toEqual(['scene-fade']);
  });

  it('uses the scene fade on the scene and nowhere else', () => {
    const users = [...CSS.matchAll(/([^{}]+)\{[^{}]*animation:[^;{}]*scene-fade/g)].map((m) => m[1].trim());
    expect(users).toEqual(['.scene']);
  });

  it('declares no grouping property on an element inside the chain', () => {
    const CHAIN = ['.entrance', '.lattice', '.piece', '.body', '.face', '.front', '.top', '.side', '.slice'];
    const GROUPING = /\b(opacity|filter|clip-path|mask|overflow)\s*:/;
    const offenders: string[] = [];
    const rules = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
    expect(rules.length, 'no rules parsed — the scan is checking nothing').toBeGreaterThan(20);
    for (const { selector, body } of rules) {
      const inChain = selector
        .split(',')
        .some((part) => CHAIN.some((cls) => new RegExp(`\\${cls}(?![\\w-])`).test(part.trim())));
      if (inChain && GROUPING.test(body)) offenders.push(selector);
    }
    expect(offenders).toEqual([]);
  });
});
