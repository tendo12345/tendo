import { SAMPLE_SYSTEM } from '../../lib/sampleSystem';
import styles from './WhatYouGet.module.css';

const CARDS = [
  { title: 'Color System', items: ['Primary', 'Secondary', 'Accent', 'Background', 'Foreground', 'Muted', 'Border', 'Destructive'] },
  { title: 'Typography', items: ['Heading font', 'Body font', 'Mood & best-for', 'Illustrative type scale'] },
  { title: 'Layout', items: ['Spacing scale', 'Border radius', 'Shadows'] },
  { title: 'Components', items: ['Button', 'Card', 'Input', 'Modal', '+ 11 more previewed live'] },
];

export function WhatYouGet() {
  return (
    <section id="what-you-get" className={`container ${styles.section}`}>
      <div className={styles.head}>
        <h2 className={styles.title}>What you get</h2>
        <p className={styles.subtitle}>Every generated system ships with the same building blocks — and the reasoning behind each one.</p>
      </div>

      <div className={styles.grid}>
        {CARDS.map((card) => (
          <div key={card.title} className={styles.card}>
            <p className={styles.cardTitle}>{card.title}</p>
            <div className={styles.list}>
              {card.items.map((item) => (
                <span key={item} className={styles.tag}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}

        <div className={`${styles.card} ${styles.cardFeatured}`}>
          <p className={styles.cardTitle}>Reasoning</p>
          <div className={styles.example}>
            <p className={styles.exampleQuestion}>Why this palette?</p>
            <p className={styles.exampleAnswer}>{SAMPLE_SYSTEM.reasoning.colors.why}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
