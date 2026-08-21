import { useMemo } from 'react';
import { assessRegion } from '../../engine/region';
import type { DesignSystemOutput } from '../../engine/types';
import styles from './RegionNotice.module.css';

/**
 * Region findings.
 *
 * Renders nothing when no region was given — an empty panel saying "nothing to report" is
 * noise. The script warning is the part that matters: it is the one place Basis can tell you
 * the generated system is wrong rather than merely debatable.
 */
export function RegionNotice({ output }: { output: DesignSystemOutput }) {
  const assessment = useMemo(() => assessRegion(output), [output]);
  if (!assessment) return null;

  const { profile, typography, direction, guidance } = assessment;
  const scriptProblem = typography && !typography.coversScript;

  return (
    <section className={styles.panel} aria-labelledby="region-heading">
      <div className={styles.head}>
        <p className={styles.eyebrow}>Region</p>
        <h3 id="region-heading" className={styles.title}>
          {profile.input}
        </h3>
        {profile.recognised && (
          <p className={styles.meta}>
            {profile.script} script · {profile.direction.toUpperCase()}
          </p>
        )}
      </div>

      {scriptProblem && (
        <div className={styles.problem} role="note">
          <p className={styles.problemTitle}>The generated fonts cannot render this language</p>
          <p className={styles.problemBody}>{typography.note}</p>
          {typography.suggestion && (
            <p className={styles.problemFix}>
              The dataset has a pairing that does:{' '}
              <strong>{typography.suggestion.name}</strong> — {typography.suggestion.heading} with{' '}
              {typography.suggestion.body}. Basis does not swap it in for you, because that would
              change a system you did not ask it to change.
            </p>
          )}
        </div>
      )}

      {typography && !scriptProblem && <p className={styles.ok}>{typography.note}</p>}

      {direction && (
        <div className={styles.rtl} role="note">
          <p className={styles.problemTitle}>Right to left</p>
          <p className={styles.problemBody}>{direction.note}</p>
        </div>
      )}

      {guidance.length > 0 && (
        <div className={styles.guidance}>
          <p className={styles.guidanceLabel}>
            {profile.recognised ? 'Delivery context — Basis guidance, not engine output' : ''}
          </p>
          <ul className={styles.guidanceList}>
            {guidance.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
