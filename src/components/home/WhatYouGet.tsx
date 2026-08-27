import { useInView } from '../../hooks/useInView';
import { Reveal } from '../motion/Reveal';
import { Stagger } from '../motion/Stagger';
import { SAMPLE_SYSTEM } from '../../lib/sampleSystem';
import styles from './WhatYouGet.module.css';

const CARDS = [
  { title: 'Color System', items: ['Primary', 'Secondary', 'Accent', 'Background', 'Foreground', 'Muted', 'Border', 'Destructive'] },
  { title: 'Typography', items: ['Heading font', 'Body font', 'Mood & best-for', 'Illustrative type scale'] },
  { title: 'Layout', items: ['Spacing scale', 'Border radius', 'Shadows'] },
  { title: 'Components', items: ['Button', 'Card', 'Input', 'Modal', '+ 11 more previewed live'] },
];

export function WhatYouGet() {
  const head = useInView<HTMLDivElement>();

  return (
    <section id="what-you-get" className={`container ${styles.section}`}>
      <div ref={head.ref} className={styles.head}>
        {/* Clip reveal on the display heading only. The subtitle is supporting copy and
            stays still — §14: reveal statements, not every line of text. */}
        <Reveal as="h2" variant="clip" className={styles.title}>
          What you get
        </Reveal>
        <p className={`${styles.subtitle} ${head.inView ? 'app-enter' : ''}`}>
          Every generated system ships with the same building blocks — and the reasoning behind each one.
        </p>
      </div>

      {/*
        One observer for the whole grid, not one per card. Five cards each watching themselves
        is five observers doing the work of one, and the pattern is what turns a page with a
        few grids into a page with a hundred observers.
      */}
      <Stagger className={styles.grid} variant="compose" step={80} maxDelay={400}>
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
      </Stagger>
    </section>
  );
}
