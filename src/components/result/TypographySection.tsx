import type { DesignSystemOutput } from '../../engine/types';
import { CopyButton } from '../ui/CopyButton';
import { Button } from '../ui/Button';
import result from './result.module.css';
import styles from './TypographySection.module.css';

interface TypographySectionProps {
  output: DesignSystemOutput;
}

const SCALE = [
  { label: 'Heading 1', size: '2.5rem', weight: 700, font: 'heading' as const },
  { label: 'Heading 2', size: '1.875rem', weight: 700, font: 'heading' as const },
  { label: 'Heading 3', size: '1.375rem', weight: 600, font: 'heading' as const },
  { label: 'Body', size: '1rem', weight: 400, font: 'body' as const },
  { label: 'Small', size: '0.875rem', weight: 400, font: 'body' as const },
  { label: 'Caption', size: '0.75rem', weight: 500, font: 'body' as const },
  { label: 'Button', size: '0.875rem', weight: 600, font: 'body' as const },
];

export function TypographySection({ output }: TypographySectionProps) {
  const { typography } = output;
  const cssImport = typography.css_import || `@import url('${typography.google_fonts_url}');`;

  return (
    <section id="typography" className={result.section} aria-labelledby="typography-heading">
      <h2 id="typography-heading" className={result.sectionTitleSpaced}>
        Typography
      </h2>

      <div className={styles.grid}>
        <div>
          <div className={styles.specimenBlock}>
            <p className={styles.specimenLabel}>Heading — {typography.heading}</p>
            <p className={styles.headingSpecimen} style={{ fontFamily: `'${typography.heading}', serif` }}>
              Build products people understand.
            </p>
            <div className={styles.meta}>
              {typography.mood && <span>Mood: {typography.mood}</span>}
              {typography.best_for && <span>Best for: {typography.best_for}</span>}
            </div>
          </div>

          <div className={styles.specimenBlock}>
            <p className={styles.specimenLabel}>Body — {typography.body}</p>
            <p className={styles.bodySpecimen} style={{ fontFamily: `'${typography.body}', sans-serif` }}>
              A design system turns one-off decisions into a repeatable, explainable set of
              defaults — so every screen looks like it belongs to the same product.
            </p>
          </div>

          <div className={styles.actions}>
            <CopyButton value={cssImport} label="Copy CSS" successMessage="Font import copied" />
            {typography.google_fonts_url && (
              <Button href={typography.google_fonts_url} external size="sm" variant="secondary">
                View Font
              </Button>
            )}
          </div>
        </div>

        <div>
          <p className={result.subheading}>Type scale (illustrative)</p>
          <div className={styles.scaleList}>
            {SCALE.map((row) => (
              <div key={row.label} className={styles.scaleRow}>
                <span className={styles.scaleLabel}>{row.label}</span>
                <span
                  className={styles.scaleSample}
                  style={{
                    fontFamily: `'${row.font === 'heading' ? typography.heading : typography.body}', sans-serif`,
                    fontSize: row.size,
                    fontWeight: row.weight,
                  }}
                >
                  Aa
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
