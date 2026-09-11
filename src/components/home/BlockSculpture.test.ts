import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
  The hero cube's stylesheet, checked for the one bug that is invisible to everything except a
  rendered frame.

  Chromium treats an active opacity animation as a grouping property — and a `both` fill keeps
  it active forever, even resting at opacity 1 — which forces `transform-style: flat` on that
  element and flattens its subtree. The first hero cube shipped that way and showed a flat grid
  of tiles on production for its whole life, while computed style reported `preserve-3d` on
  every element.

  Opacity is allowed in exactly one place: the scene, the root of the 3D context, where
  flattening has nothing left to flatten.
*/

// Comments stripped first: the stylesheet's prose names the banned properties and the chain's
// classes, and a rule parser reading comment text as a selector would flag its own warnings.
const CSS = readFileSync(join(process.cwd(), 'src', 'components', 'home', 'BlockSculpture.module.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

const CHAIN = ['.cube', '.cubie', '.face', '.front', '.back', '.right', '.left', '.top', '.bottom'];
const GROUPING = /\b(opacity|filter|clip-path|mask|overflow)\s*:/;

describe('the 3D chain carries no grouping property', () => {
  it('animates opacity only in the scene fade', () => {
    const keyframes = [...CSS.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)];
    expect(keyframes.length, 'no keyframes parsed — the scan is checking nothing').toBeGreaterThan(1);
    const withOpacity = keyframes.filter(([, , body]) => /\bopacity\s*:/.test(body)).map(([, name]) => name);
    expect(withOpacity).toEqual(['scene-fade']);
  });

  it('uses the scene fade on the scene and nowhere else', () => {
    const users = [...CSS.matchAll(/([^{}]+)\{[^{}]*animation:[^;{}]*scene-fade/g)].map((m) => m[1].trim());
    expect(users).toEqual(['.scene']);
  });

  it('declares no grouping property on an element inside the chain', () => {
    const rules = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
    expect(rules.length, 'no rules parsed — the scan is checking nothing').toBeGreaterThan(10);
    const offenders = rules
      .filter(({ selector }) =>
        selector.split(',').some((part) => CHAIN.some((cls) => new RegExp(`\\${cls}(?![\\w-])`).test(part.trim()))),
      )
      .filter(({ body }) => GROUPING.test(body))
      .map(({ selector }) => selector);
    expect(offenders).toEqual([]);
  });

  /*
    Faces are culled rather than drawn from behind. Without this every cubie draws six planes
    instead of three, and the inside faces of a turning layer show through the ones in front.
  */
  it('culls faces turned away from the viewer', () => {
    const face = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].trim() === '.face');
    expect(face?.[2]).toMatch(/backface-visibility:\s*hidden/);
  });
});
