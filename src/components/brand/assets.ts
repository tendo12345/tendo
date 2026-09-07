/*
  Where the brand art lives, and how big it is.

  Separate from BasisLogo.tsx only because a file that exports both a component and constants
  breaks React Fast Refresh — oxlint's `only-export-components`. Seven files in this repo
  already carry that warning; this one does not need to be the eighth.

  Everything here is produced by scripts/build-brand.py from brand/basis-logo-master.png.
  Nothing in this directory is hand-drawn or hand-edited.
*/

export const MARK_SRC = '/brand/basis-mark.png';
export const WORD_SRC = '/brand/basis-wordmark.png';
/** The same wordmark recoloured to parchment, for dark surfaces. See §23 in build-brand.py. */
export const WORD_LIGHT_SRC = '/brand/basis-wordmark-light.png';

/*
  Intrinsic pixel sizes, passed to the <img> as width/height attributes.

  Not decoration: they give the browser the aspect ratio before the bytes arrive, so the bar
  reserves the right box on first paint instead of reflowing when the logo loads. CSS then
  sets the real height and leaves width auto, so the attributes never fight the layout — they
  only supply the ratio.

  These must match what build-brand.py emits. brand.test.ts reads the real PNG headers and
  fails if they drift, which is the only thing standing between a regenerated asset and a
  silent layout shift on every cold load.
*/
export const MARK_INTRINSIC = { width: 196, height: 256 };
export const WORD_INTRINSIC = { width: 383, height: 128 };
