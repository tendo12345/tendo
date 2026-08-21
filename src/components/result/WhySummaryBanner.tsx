import type { DesignSystemOutput } from '../../engine/types';
import { buildWhySummary } from '../../lib/whySummary';
import styles from './WhySummaryBanner.module.css';

interface WhySummaryBannerProps {
  output: DesignSystemOutput;
}

export function WhySummaryBanner({ output }: WhySummaryBannerProps) {
  const { sentence, principles } = buildWhySummary(output);

  return (
    <div className="container">
      <div className={styles.banner}>
        <p className={styles.sentence}>{sentence}</p>
        {principles.length > 0 && (
          <div className={styles.principles}>
            {principles.map((p) => (
              <div key={p} className={styles.principle}>
                <span className={styles.principleDot} aria-hidden="true" />
                <span className={styles.principleLabel}>{p}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
