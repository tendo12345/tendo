import type { MatchAssessment } from '../../engine/matchQuality';
import styles from './MatchBadge.module.css';

interface MatchBadgeProps {
  assessment: MatchAssessment;
  /** Renders the supporting sentence underneath. Off inside dense rows. */
  showBasis?: boolean;
}

/**
 * Match strength for one decision.
 *
 * Shows a label, never a percentage — the engine ranks with BM25, whose raw scores are not
 * comparable between dimensions, so a number here would be invented precision.
 */
export function MatchBadge({ assessment, showBasis = false }: MatchBadgeProps) {
  return (
    <div className={styles.wrap}>
      <span className={`${styles.badge} ${styles[assessment.level]}`}>{assessment.label}</span>
      {showBasis && <p className={styles.basis}>{assessment.basis}</p>}
    </div>
  );
}

/**
 * The louder treatment for a dimension that fell back to a documented default.
 * Fallbacks are never silent — that is the whole point of showing them.
 */
export function FallbackNotice({ assessment }: { assessment: MatchAssessment }) {
  if (!assessment.isFallback) return null;
  return (
    <div className={styles.fallbackNotice} role="note">
      <span className={styles.fallbackTitle}>Fallback used</span>
      <p className={styles.fallbackBody}>{assessment.basis}</p>
    </div>
  );
}
