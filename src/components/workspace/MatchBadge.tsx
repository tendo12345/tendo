import { Badge } from '../ui/Badge';
import type { MatchAssessment, MatchLevel } from '../../engine/matchQuality';
import styles from './MatchBadge.module.css';

interface MatchBadgeProps {
  assessment: MatchAssessment;
  /** Renders the supporting sentence underneath. Off inside dense rows. */
  showBasis?: boolean;
}

const TONE_BY_LEVEL: Record<MatchLevel, 'positive' | 'neutral' | 'warning'> = {
  strong: 'positive',
  good: 'neutral',
  weak: 'warning',
  fallback: 'warning',
};

/**
 * Match strength for one decision.
 *
 * Shows a label, never a percentage — the engine ranks with BM25, whose raw scores are not
 * comparable between dimensions, so a number here would be invented precision.
 */
export function MatchBadge({ assessment, showBasis = false }: MatchBadgeProps) {
  return (
    <div className={styles.wrap}>
      <Badge tone={TONE_BY_LEVEL[assessment.level]}>{assessment.label}</Badge>
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
