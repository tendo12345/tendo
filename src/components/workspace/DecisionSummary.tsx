import { useMemo } from 'react';
import { assessMatchQuality } from '../../engine/matchQuality';
import type { DesignSystemOutput } from '../../engine/types';
import { FallbackNotice, MatchBadge } from './MatchBadge';
import { WhyDisclosure } from './WhyDisclosure';
import styles from './DecisionSummary.module.css';

/** The five decisions the engine actually makes, paired with their reasoning. */
const DECISIONS = [
  { key: 'product', label: 'Product match', reasoningKey: 'category', valueOf: (o: DesignSystemOutput) => o.category },
  { key: 'style', label: 'Design direction', reasoningKey: 'style', valueOf: (o: DesignSystemOutput) => o.style.name },
  { key: 'colors', label: 'Palette', reasoningKey: 'colors', valueOf: (o: DesignSystemOutput) => o.colors.primary },
  { key: 'typography', label: 'Typography', reasoningKey: 'typography', valueOf: (o: DesignSystemOutput) => `${o.typography.heading} / ${o.typography.body}` },
  { key: 'pattern', label: 'Layout pattern', reasoningKey: 'pattern', valueOf: (o: DesignSystemOutput) => o.pattern.name },
] as const;

/**
 * Every major decision with its match strength, fallback status and reasoning.
 *
 * This is the answer to "why was this chosen?" on the Overview, without making the reader
 * hunt through the Reasoning section for it.
 */
export function DecisionSummary({ output }: { output: DesignSystemOutput }) {
  const quality = useMemo(() => assessMatchQuality(output), [output]);
  const fallbacks = Object.entries(quality).filter(([, a]) => a.isFallback);

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h3 className={styles.title}>Decisions</h3>
        <p className={styles.count}>
          {fallbacks.length === 0
            ? 'Every dimension matched the dataset.'
            : `${fallbacks.length} of ${Object.keys(quality).length} dimensions fell back to a documented default.`}
        </p>
      </div>

      <ul className={styles.list}>
        {DECISIONS.map((d) => {
          const assessment = quality[d.key];
          const reasoning = output.reasoning[d.reasoningKey];
          return (
            <li key={d.key} className={styles.item}>
              <div className={styles.itemHead}>
                <div className={styles.itemMain}>
                  <p className={styles.label}>{d.label}</p>
                  <p className={styles.value}>{d.valueOf(output)}</p>
                </div>
                <MatchBadge assessment={assessment} />
              </div>
              <FallbackNotice assessment={assessment} />
              <WhyDisclosure reasoning={reasoning} assessment={assessment} />
            </li>
          );
        })}
      </ul>

      <div className={styles.tokenRow}>
        <p className={styles.tokenTitle}>Token sources</p>
        <ul className={styles.tokenList}>
          {(['radius', 'spacing', 'motion'] as const).map((k) => (
            <li key={k} className={styles.tokenItem}>
              <span className={styles.tokenLabel}>{k}</span>
              <MatchBadge assessment={quality[k]} />
              <span className={styles.tokenBasis}>{quality[k].basis}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
