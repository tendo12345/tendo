import { Link } from 'react-router-dom';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { COVERAGE } from '../../lib/coverage';
import styles from './CoverageCard.module.css';

/*
  The one coloured surface in the system.

  Everything else in Basis is parchment with a hairline border; this card is Periwinkle Mist,
  which is exactly the role the design system gives it — a single elevated surface that draws
  the eye, used once. Adding a second one would spend the effect.

  Every number here is counted from the real datasets at build time (see lib/coverage.ts). On
  a product whose entire claim is that it does not invent figures, a hand-typed "160+ product
  types" on the landing page would be the worst possible place to be approximately right.
*/

export function CoverageCard() {
  const reducedMotion = usePrefersReducedMotion();

  /*
    The column is rendered twice, back to back, and the track scrolls exactly one copy's
    height before looping. That is what makes the wrap invisible — at the moment it resets,
    the second copy is occupying the same pixels the first did, so there is no seam to see.

    aria-hidden on the duplicate: it is the same words again, and a screen reader announcing
    the whole list twice would be a bug, not breadth.
  */
  const names = COVERAGE.sampleProducts;

  return (
    <section className={`container ${styles.wrap}`} aria-labelledby="coverage-heading">
      <div className={styles.card}>
        <div className={styles.copy}>
          <h2 id="coverage-heading" className={styles.heading}>
            It Already Knows Your Product.
          </h2>
          <p className={styles.body}>
            {COVERAGE.productCount} product types, {COVERAGE.styleCount} design styles,{' '}
            {COVERAGE.paletteCount} palettes and {COVERAGE.pairingCount} font pairings — matched
            against what you describe, not generated from a prompt.
          </p>
          <Link to="/generator" className={styles.cta}>
            Try your product
          </Link>
        </div>

        <div className={styles.listFrame} aria-hidden="true">
          <div className={`${styles.track} ${reducedMotion ? styles.trackStill : ''}`}>
            {names.map((name) => (
              <span key={name} className={styles.item}>
                {name}
              </span>
            ))}
            {!reducedMotion &&
              names.map((name) => (
                <span key={`dup-${name}`} className={styles.item}>
                  {name}
                </span>
              ))}
          </div>
        </div>

        {/* The full list, for anyone the visual column is hidden from. */}
        <p className="visually-hidden">
          Product types the engine matches against include: {names.join(', ')}.
        </p>
      </div>
    </section>
  );
}
