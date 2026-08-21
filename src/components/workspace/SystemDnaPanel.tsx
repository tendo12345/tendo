import { useMemo } from 'react';
import { buildSystemDna } from '../../engine/systemDna';
import type { DesignSystemOutput } from '../../engine/types';
import styles from './SystemDnaPanel.module.css';

/**
 * System DNA — the character of the system, in words.
 *
 * Traits are qualitative and evidenced. Each one names the engine field it came from and
 * quotes it, because the engine has no way to score "how trustworthy" a system is and a
 * number here would be fiction. Countable facts are shown separately as measurements.
 */
export function SystemDnaPanel({ output }: { output: DesignSystemOutput }) {
  const dna = useMemo(() => buildSystemDna(output), [output]);

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>Design character</p>
        {dna.traits.length > 0 && (
          <ul className={styles.traits}>
            {dna.traits.map((t) => (
              <li key={t.trait} className={styles.trait}>
                {t.trait}
              </li>
            ))}
          </ul>
        )}
        <p className={styles.summary}>{dna.summary}</p>
      </div>

      {dna.traits.length > 0 && (
        <details className={styles.evidence}>
          <summary className={styles.evidenceToggle}>Where these come from</summary>
          <ul className={styles.evidenceList}>
            {dna.traits.map((t) => (
              <li key={t.trait} className={styles.evidenceItem}>
                <span className={styles.evidenceTrait}>{t.trait}</span>
                <span className={styles.evidenceField}>{t.field}</span>
                <span className={styles.evidenceText}>&ldquo;{t.evidence}&rdquo;</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <dl className={styles.measures}>
        {dna.measures.map((m) => (
          <div key={m.label} className={styles.measure}>
            <dt className={styles.measureLabel}>{m.label}</dt>
            <dd className={styles.measureValue}>{m.value}</dd>
            <dd className={styles.measureNote}>{m.note}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
