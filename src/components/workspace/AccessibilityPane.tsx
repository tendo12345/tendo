import { useMemo } from 'react';
import { auditAccessibility, type AuditStatus } from '../../engine/accessibility';
import { assessSystemHealth } from '../../engine/systemHealth';
import type { DesignSystemOutput } from '../../engine/types';
import result from '../result/result.module.css';
import styles from './AccessibilityPane.module.css';

const STATUS_LABEL: Record<AuditStatus, string> = {
  pass: 'Pass',
  warning: 'Warning',
  attention: 'Needs attention',
};

/**
 * Accessibility audit and system health.
 *
 * Only computed checks appear. Criteria that need a rendered page or a human — alt text,
 * reading order, screen-reader labelling — are named as unchecked rather than passed,
 * because a green tick on an untested criterion is worse than no tick at all.
 */
export function AccessibilityPane({ output }: { output: DesignSystemOutput }) {
  const audit = useMemo(() => auditAccessibility(output), [output]);
  const health = useMemo(() => assessSystemHealth(output), [output]);

  return (
    <section aria-labelledby="a11y-heading" className={result.section}>
      <h2 id="a11y-heading" className={result.sectionTitleSpaced}>
        Accessibility
      </h2>
      <p className={result.sectionIntro}>
        {audit.counts.pass} of {audit.findings.length} checks pass
        {audit.counts.warning > 0 && `, ${audit.counts.warning} warn`}
        {audit.counts.attention > 0 && `, ${audit.counts.attention} need attention`}. Every result
        below is measured from your generated values.
      </p>

      <ul className={styles.findings}>
        {audit.findings.map((f) => (
          <li key={f.id} className={styles.finding}>
            <div className={styles.findingHead}>
              <div>
                <p className={styles.findingCategory}>{f.category}</p>
                <p className={styles.findingTitle}>{f.title}</p>
              </div>
              <span className={`${styles.status} ${styles[f.status]}`}>{STATUS_LABEL[f.status]}</span>
            </div>
            <p className={styles.detail}>{f.detail}</p>
            {f.why && (
              <p className={styles.why}>
                <span className={styles.whyLabel}>Why it matters</span> {f.why}
              </p>
            )}
            {f.fix && (
              <p className={styles.fix}>
                <span className={styles.whyLabel}>How to fix</span> {f.fix}
              </p>
            )}
          </li>
        ))}
      </ul>

      <h3 className={styles.subTitle}>Contrast detail</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Pair</th>
              <th scope="col">Foreground</th>
              <th scope="col">Background</th>
              <th scope="col">Ratio</th>
              <th scope="col">Needs</th>
              <th scope="col">Level</th>
            </tr>
          </thead>
          <tbody>
            {audit.contrastPairs.map((p) => (
              <tr key={p.label} className={p.status !== 'pass' ? styles.rowFail : undefined}>
                <th scope="row" className={styles.rowLabel}>
                  {p.label}
                </th>
                <td>
                  <span className={styles.swatch} style={{ background: p.foreground }} />
                  <code>{p.foreground}</code>
                </td>
                <td>
                  <span className={styles.swatch} style={{ background: p.background }} />
                  <code>{p.background}</code>
                </td>
                <td className={styles.num}>{p.ratio ? `${p.ratio.toFixed(2)}:1` : '—'}</td>
                <td className={styles.num}>{p.required}:1</td>
                <td>{p.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={styles.subTitle}>System health</h3>
      <ul className={styles.health}>
        {health.areas.map((a) => (
          <li key={a.area} className={styles.healthRow}>
            <span className={styles.healthArea}>{a.area}</span>
            <span className={`${styles.rating} ${styles[a.rating]}`}>
              {a.rating === 'attention' ? 'Needs attention' : a.rating === 'good' ? 'Good' : 'Strong'}
            </span>
            <span className={styles.healthMeasure}>
              {a.measure}
              {a.improve && <em className={styles.improve}> {a.improve}</em>}
            </span>
          </li>
        ))}
      </ul>

      <div className={styles.notChecked}>
        <p className={styles.notCheckedTitle}>Not checked here</p>
        <p className={styles.notCheckedBody}>
          Alt text, heading order, reading order, screen-reader labelling and keyboard tab order
          cannot be verified from a token set — they depend on the markup you write. Basis does not
          mark them as passing, because it has not tested them.
        </p>
      </div>
    </section>
  );
}
