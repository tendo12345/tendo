import type { DesignSystemOutput } from '../../engine/types';
import { DesignSystemScope } from './DesignSystemScope';
import ds from './dsPreview.module.css';
import result from './result.module.css';
import styles from './OverviewSection.module.css';

interface OverviewSectionProps {
  output: DesignSystemOutput;
}

export function OverviewSection({ output }: OverviewSectionProps) {
  const swatches = [output.colors.primary, output.colors.secondary, output.colors.accent, output.colors.background];

  return (
    <section id="overview" className={result.section} aria-labelledby="overview-heading">
      <h2 id="overview-heading" className={result.sectionTitleSpaced}>
        Overview
      </h2>

      <DesignSystemScope output={output}>
        <div className={styles.grid}>
          <div className={result.panel}>
            <p className={result.subheading}>Design direction</p>
            <p className={styles.directionName}>{output.style.name}</p>
            <p className={styles.directionDetail}>{output.style.best_for}</p>
          </div>

          <div className={result.panel}>
            <p className={result.subheading}>Color</p>
            <div className={styles.swatchRow}>
              {swatches.map((hex) => (
                <span key={hex} className={styles.swatch} style={{ background: hex }} title={hex} />
              ))}
            </div>
          </div>

          <div className={result.panel}>
            <p className={result.subheading}>Typography</p>
            <div className={styles.typeSample}>
              <span className={`${ds.heading} ${styles.headingSample}`}>{output.typography.heading}</span>
              <span className={styles.bodyLabel}>{output.typography.body} — body text</span>
            </div>
          </div>

          <div className={result.panel}>
            <p className={result.subheading}>Shape</p>
            <div className={styles.previewRow}>
              <button type="button" className={ds.button}>
                Button
              </button>
              <div className={`${ds.card} ${styles.cardSample}`}>Card</div>
            </div>
          </div>

          <div className={`${result.panel} ${styles.wideCard}`}>
            <p className={result.subheading}>Layout</p>
            <p className={styles.layoutNote}>
              {output.spacing.length} spacing tokens ({output.spacing[0]?.px}–{output.spacing[output.spacing.length - 1]?.px}) ·{' '}
              {output.radius.length} radius tokens · {output.pattern.name} layout pattern
            </p>
          </div>
        </div>
      </DesignSystemScope>
    </section>
  );
}
