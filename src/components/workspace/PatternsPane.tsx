import { useMemo } from 'react';
import { buildProductPatterns } from '../../engine/productPatterns';
import type { DesignSystemOutput } from '../../engine/types';
import result from '../result/result.module.css';
import styles from './PatternsPane.module.css';

/**
 * Screens worth building for this product type.
 *
 * These are Basis recommendations, not engine output — the dataset carries no list of
 * interface patterns. The banner says so, because presenting guidance as generated
 * reasoning would undermine the reasoning that IS generated.
 */
export function PatternsPane({ output }: { output: DesignSystemOutput }) {
  const patterns = useMemo(() => buildProductPatterns(output), [output]);

  return (
    <section aria-labelledby="patterns-heading" className={result.section}>
      <h2 id="patterns-heading" className={result.sectionTitleSpaced}>
        Patterns
      </h2>

      <div className={styles.notice} role="note">
        <p className={styles.noticeTitle}>Guidance, not generated</p>
        <p className={styles.noticeBody}>
          The dataset behind Basis has no list of interface patterns. These are recommendations
          for <strong>{patterns.family}</strong>, selected by matching your product category.{' '}
          {patterns.matchedOn}
        </p>
      </div>

      {patterns.keyConsiderations && (
        <div className={styles.dataset}>
          <p className={styles.datasetLabel}>From the dataset for {output.category}</p>
          <p className={styles.datasetBody}>{patterns.keyConsiderations}</p>
        </div>
      )}

      <ul className={styles.list}>
        {patterns.patterns.map((p) => (
          <li key={p} className={styles.item}>
            {p}
          </li>
        ))}
      </ul>
    </section>
  );
}
