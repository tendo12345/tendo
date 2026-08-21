import { useId, useState } from 'react';
import type { Reasoning } from '../../engine/types';
import type { MatchAssessment } from '../../engine/matchQuality';
import { MatchBadge } from './MatchBadge';
import styles from './WhyDisclosure.module.css';

interface WhyDisclosureProps {
  /** The engine's own reasoning for this decision. Never paraphrased here. */
  reasoning: Reasoning;
  assessment?: MatchAssessment;
  /** Optional label override, e.g. "Why this font?". */
  label?: string;
}

/**
 * The "Why?" affordance.
 *
 * Everything it shows comes from the engine: the `why` string, its `source`, and its
 * `evidence` map. Nothing is generated here, so the explanation can never drift from the
 * decision it explains.
 */
export function WhyDisclosure({ reasoning, assessment, label = 'Why?' }: WhyDisclosureProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.triggerIcon} aria-hidden="true">
          {open ? '−' : '+'}
        </span>
        {label}
      </button>

      {open && (
        <div id={panelId} className={styles.panel}>
          <p className={styles.why}>{reasoning.why}</p>

          {assessment && (
            <div className={styles.row}>
              <span className={styles.key}>Match</span>
              <div className={styles.val}>
                <MatchBadge assessment={assessment} />
                <p className={styles.basis}>{assessment.basis}</p>
              </div>
            </div>
          )}

          <div className={styles.row}>
            <span className={styles.key}>Source</span>
            <span className={`${styles.val} ${styles.mono}`}>{reasoning.source}</span>
          </div>

          {reasoning.evidence &&
            Object.entries(reasoning.evidence)
              .filter(([, v]) => v !== '' && v !== undefined)
              .map(([k, v]) => (
                <div className={styles.row} key={k}>
                  <span className={styles.key}>{k.replace(/_/g, ' ')}</span>
                  <span className={styles.val}>{v}</span>
                </div>
              ))}
        </div>
      )}
    </div>
  );
}
