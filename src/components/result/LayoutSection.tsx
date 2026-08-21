import type { DesignSystemOutput } from '../../engine/types';
import result from './result.module.css';
import styles from './LayoutSection.module.css';

interface LayoutSectionProps {
  output: DesignSystemOutput;
}

export function LayoutSection({ output }: LayoutSectionProps) {
  const maxPx = Math.max(...output.spacing.map((s) => parseInt(s.px, 10) || 0));

  return (
    <section id="layout" className={result.section} aria-labelledby="layout-heading">
      <h2 id="layout-heading" className={result.sectionTitleSpaced}>
        Layout
      </h2>
      <p className={result.sectionIntro}>{output.reasoning.spacing.why}</p>

      <p className={result.subheading}>Spacing scale</p>
      <div className={styles.blockRow}>
        {output.spacing.map((token) => {
          const px = parseInt(token.px, 10) || 0;
          const height = Math.max(4, (px / maxPx) * 96);
          return (
            <div key={token.token} className={styles.blockItem}>
              <div className={styles.block} style={{ height: `${height}px` }} title={token.usage} />
              <span className={styles.blockLabel}>{token.px}</span>
            </div>
          );
        })}
      </div>

      <p className={result.subheading}>Border radius</p>
      <div className={styles.tokenGrid}>
        {output.radius.map((token) => (
          <div key={token.token} className={styles.tokenCard}>
            <div className={styles.radiusPreview} style={{ borderRadius: token.value }} />
            <p className={styles.tokenName}>
              {token.token} — {token.value}
            </p>
            <p className={styles.tokenUsage}>{token.usage}</p>
          </div>
        ))}
      </div>

      <p className={result.subheading}>Shadows</p>
      <div className={styles.tokenGrid}>
        {output.shadows.map((token) => (
          <div key={token.token} className={styles.tokenCard}>
            <div className={styles.shadowPreview} style={{ boxShadow: token.value }} />
            <p className={styles.tokenName}>{token.token}</p>
            <p className={styles.tokenUsage}>{token.usage}</p>
          </div>
        ))}
      </div>

      <p className={styles.note}>
        This engine output doesn't include container width, grid, or breakpoint tokens — only spacing, radius, and shadow scales.
      </p>
    </section>
  );
}
