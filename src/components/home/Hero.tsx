import type { CSSProperties } from 'react';
import { SAMPLE_SYSTEM as SAMPLE } from '../../lib/sampleSystem';
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
*/
function enterAt(ms: number): CSSProperties {
  return { '--app-enter-delay': `${ms}ms` } as CSSProperties;
}

export function Hero() {
  const swatches = [SAMPLE.colors.primary, SAMPLE.colors.secondary, SAMPLE.colors.accent, SAMPLE.colors.background];

  return (
    <section className={`container ${styles.hero}`}>
      <p className={`${styles.eyebrow} app-enter`} style={enterAt(0)}>
        Design System Generator
      </p>
      <h1 className={`${styles.headline} app-enter`} style={enterAt(60)}>
        Turn a product idea into a complete design system.
      </h1>
      <p className={`${styles.supporting} app-enter`} style={enterAt(120)}>
        Describe what you're building and get a practical design direction with colors, typography, spacing,
        components, and the reasoning behind every major choice.
      </p>
      <div className={`${styles.ctas} app-enter`} style={enterAt(180)}>
        <Button href="/generator" variant="primary">
          Generate a Design System
        </Button>
        <Button href="#what-you-get" variant="secondary">
          Explore Examples
        </Button>
      </div>

      <DesignSystemScope output={SAMPLE}>
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
      </DesignSystemScope>
    </section>
  );
}
