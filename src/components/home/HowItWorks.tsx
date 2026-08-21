import { useState } from 'react';
import { SAMPLE_SYSTEM } from '../../lib/sampleSystem';
import { Chip } from '../ui/Chip';
import { DesignSystemScope } from '../result/DesignSystemScope';
import ds from '../result/dsPreview.module.css';
import styles from './HowItWorks.module.css';

const STEPS = [
  {
    number: '01',
    title: 'Describe your product',
    example: '"A SaaS analytics dashboard for small businesses."',
  },
  {
    number: '02',
    title: 'Add your design direction',
    example: 'Minimal · Professional · Playful · Premium · Dark · Editorial · Friendly',
  },
  {
    number: '03',
    title: 'Generate your system',
    example: 'Colors, typography, spacing, components, and design reasoning.',
  },
];

const DIRECTION_WORDS = ['Minimal', 'Professional', 'Playful', 'Premium', 'Dark', 'Editorial', 'Friendly'];

function StepPreview({ index }: { index: number }) {
  if (index === 0) {
    return <p className={styles.previewText}>"A SaaS analytics dashboard for small businesses."</p>;
  }
  if (index === 1) {
    return (
      <div className={styles.previewChips}>
        {DIRECTION_WORDS.map((word) => (
          <Chip key={word}>{word}</Chip>
        ))}
      </div>
    );
  }
  return (
    <DesignSystemScope output={SAMPLE_SYSTEM}>
      <div className={styles.previewGenerated}>
        <div className={styles.previewSwatches}>
          {[SAMPLE_SYSTEM.colors.primary, SAMPLE_SYSTEM.colors.secondary, SAMPLE_SYSTEM.colors.accent].map((hex) => (
            <span key={hex} className={styles.previewSwatch} style={{ background: hex }} />
          ))}
        </div>
        <button type="button" className={ds.button}>
          Continue
        </button>
      </div>
    </DesignSystemScope>
  );
}

export function HowItWorks() {
  const [active, setActive] = useState(0);

  return (
    <section className={`container ${styles.section}`}>
      <div className={styles.head}>
        <h2 className={styles.title}>How it works</h2>
      </div>
      <div className={styles.grid}>
        <div className={styles.steps}>
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className={`${styles.step} ${i === active ? styles.stepActive : ''}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              tabIndex={0}
              role="button"
            >
              <span className={styles.stepNumber}>{step.number}</span>
              <div>
                <p className={styles.stepTitle}>{step.title}</p>
                <p className={styles.stepExample}>{step.example}</p>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.preview}>
          <StepPreview index={active} />
        </div>
      </div>
    </section>
  );
}
