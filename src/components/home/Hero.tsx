import { SAMPLE_SYSTEM as SAMPLE } from '../../lib/sampleSystem';
import { DesignSystemScope } from '../result/DesignSystemScope';
import ds from '../result/dsPreview.module.css';
import { Button } from '../ui/Button';
import styles from './Hero.module.css';

export function Hero() {
  const swatches = [SAMPLE.colors.primary, SAMPLE.colors.secondary, SAMPLE.colors.accent, SAMPLE.colors.background];

  return (
    <section className={`container ${styles.hero}`}>
      <p className={styles.eyebrow}>Design System Generator</p>
      <h1 className={styles.headline}>Turn a product idea into a complete design system.</h1>
      <p className={styles.supporting}>
        Describe what you're building and get a practical design direction with colors, typography, spacing,
        components, and the reasoning behind every major choice.
      </p>
      <div className={styles.ctas}>
        <Button href="/generator" variant="primary">
          Generate a Design System
        </Button>
        <Button href="#what-you-get" variant="secondary">
          Explore Examples
        </Button>
      </div>

      <DesignSystemScope output={SAMPLE}>
        <div className={styles.previewFrame}>
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
