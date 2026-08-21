import type { DesignSystemOutput, Reasoning } from '../../engine/types';
import result from './result.module.css';
import styles from './ReasoningSection.module.css';

interface ReasoningSectionProps {
  output: DesignSystemOutput;
}

const LABELS: Record<keyof DesignSystemOutput['reasoning'], string> = {
  category: 'Category',
  pattern: 'Layout pattern',
  style: 'Style',
  colors: 'Palette',
  typography: 'Typography',
  effects: 'Effects',
  spacing: 'Spacing',
  components: 'Components',
  antiPatterns: 'Anti-patterns',
};

function ReasoningCard({ label, reasoning }: { label: string; reasoning: Reasoning }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.label}>{label}</span>
      </div>
      <p className={styles.decision}>{reasoning.decision}</p>
      <p className={styles.why}>{reasoning.why}</p>
      <p className={styles.source}>Source: {reasoning.source}</p>
      {reasoning.evidence && Object.keys(reasoning.evidence).length > 0 && (
        <div className={styles.evidence}>
          {Object.entries(reasoning.evidence).map(([key, value]) =>
            value ? (
              <span key={key} className={styles.evidenceItem}>
                {key}: {value}
              </span>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

export function ReasoningSection({ output }: ReasoningSectionProps) {
  return (
    <section id="reasoning" className={result.section} aria-labelledby="reasoning-heading">
      <h2 id="reasoning-heading" className={result.sectionTitleSpaced}>
        Reasoning
      </h2>
      <p className={result.sectionIntro}>
        Every recommendation above traces back to a decision here — matched data, priority rules, and which
        selection branch fired. Nothing on this page is invented after the fact.
      </p>
      <div className={styles.list}>
        {(Object.keys(output.reasoning) as Array<keyof DesignSystemOutput['reasoning']>).map((key) => (
          <ReasoningCard key={key} label={LABELS[key]} reasoning={output.reasoning[key]} />
        ))}
      </div>
    </section>
  );
}
