import type { CSSProperties } from 'react';
import { useSectionProgress } from '../../hooks/useScrollMotion';
import { SAMPLE_SYSTEM as SAMPLE } from '../../lib/sampleSystem';
import { BlockSculpture } from './BlockSculpture';
import { Parallax } from '../motion/Parallax';
import { DesignSystemScope } from '../result/DesignSystemScope';
import ds from '../result/dsPreview.module.css';
import { Button } from '../ui/Button';
import styles from './Hero.module.css';

/*
  The hero settles in sequence rather than all at once: eyebrow, headline, supporting copy,
  actions, then the preview. Each step is one beat behind the last, which reads as a page
  being set rather than a UI booting.

  Delays stay short on purpose — the longest is 240ms, so the whole hero is resolved well
  inside half a second and nobody waits on decoration. Under prefers-reduced-motion the
  global backstop collapses the animation, and `both` means every element still ends in its
  final state rather than stuck at opacity 0.

  On scroll the hero does not simply leave. Each band drifts at its own rate — the preview
  furthest, the eyebrow least — so the composition compresses instead of sliding away as one
  sheet. The numbers are small by design: this should register as depth, not as movement.

  Parallax is a WRAPPER around each band rather than a class on it, and that is structural.
  The entrance animation animates `transform`; so does parallax. On one element the animation
  wins and the parallax silently does nothing. Nesting gives each its own node and its own
  transform, so the two compose instead of competing.

  The composition is two-part: type on the left, the block sculpture on the right. The copy is
  left-aligned rather than centred because a centred column beside a large object reads as two
  competing centres — the ragged right edge is what lets the sculpture hold the other side.

  The sample preview stays, below the two-part block. It is real engine output and the most
  honest thing on the page, so it was not going to be deleted to make room; it simply sits
  under the first screen instead of inside it.
*/
function enterAt(ms: number): CSSProperties {
  return { '--app-enter-delay': `${ms}ms` } as CSSProperties;
}

export function Hero() {
  const swatches = [SAMPLE.colors.primary, SAMPLE.colors.secondary, SAMPLE.colors.accent, SAMPLE.colors.background];
  /* Drives the sculpture's recede-on-scroll. The text bands use Parallax and move faster,
     which is what puts the object behind them in depth. */
  const heroRef = useSectionProgress<HTMLElement>();

  return (
    <section ref={heroRef} className={`container ${styles.hero}`}>
      <div className={styles.composition}>
        <div className={styles.copy}>
          <Parallax speed={-10}>
            <p className={`${styles.eyebrow} app-enter`} style={enterAt(0)}>
              Design System Generator
            </p>
          </Parallax>
          <Parallax speed={-26}>
            <h1 className={`${styles.headline} app-clip-in`} style={enterAt(80)}>
              Turn a Product Idea Into a Complete Design System.
            </h1>
          </Parallax>
          <Parallax speed={-18}>
            <p className={`${styles.supporting} app-enter`} style={enterAt(150)}>
              Describe what you're building and get a practical design direction with colors, typography,
              spacing, components, and the reasoning behind every major choice.
            </p>
          </Parallax>
          <Parallax speed={-14}>
            <div className={`${styles.ctas} app-enter`} style={enterAt(220)}>
              <Button href="/generator" variant="primary">
                Generate a Design System
              </Button>
              <Button href="#what-you-get" variant="secondary">
                Explore Examples
              </Button>
            </div>
          </Parallax>

        </div>

        <div className={styles.object}>
          <BlockSculpture />
        </div>
      </div>

      <DesignSystemScope output={SAMPLE}>
        <Parallax speed={-40} className={styles.previewCarrier}>
        <div className={`${styles.previewFrame} app-enter`} style={enterAt(240)}>
          <div className={styles.previewBar}>
            <span>{SAMPLE.category} — generated from "fintech mobile app, trustworthy, modern, minimal"</span>
            <span className={styles.previewDots}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </span>
          </div>
          <div className={styles.previewBody}>
            <div className={styles.previewBlock}>
              <span className={styles.previewLabel}>Palette</span>
              <div className={styles.swatchRow}>
                {swatches.map((hex) => (
                  <span key={hex} className={styles.swatch} style={{ background: hex }} />
                ))}
              </div>
            </div>
            <div className={styles.previewBlock}>
              <span className={styles.previewLabel}>Typography</span>
              <span className={ds.heading} style={{ fontSize: '1.1rem' }}>
                {SAMPLE.typography.heading}
              </span>
              <span className={ds.tileSub}>{SAMPLE.typography.body}</span>
            </div>
            <div className={styles.previewBlock}>
              <span className={styles.previewLabel}>Components</span>
              <button type="button" className={ds.button}>
                Continue
              </button>
              <input className={ds.input} placeholder="Email" readOnly />
            </div>
            <div className={styles.previewBlock}>
              <span className={styles.previewLabel}>Spacing</span>
              <div className={styles.spacingRow}>
                {SAMPLE.spacing.map((s) => (
                  <span key={s.token} className={styles.spacingBlock} style={{ height: s.px }} />
                ))}
              </div>
            </div>
          </div>
        </div>
        </Parallax>
      </DesignSystemScope>
    </section>
  );
}
