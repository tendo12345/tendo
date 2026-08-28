import { useCallback, useState } from 'react';
import { useInView } from '../../hooks/useInView';
import { useSectionProgress } from '../../hooks/useScrollMotion';
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

/*
  Scroll advances the explanation; pointing at a step still wins.

  The section was already interactive — hover or focus a step and the panel changes. Making it
  scroll-driven must not take that away, so the two inputs are kept separate rather than
  fighting over one piece of state: `hovered` is whatever the user is pointing at, `stage` is
  where the scroll has got to, and the panel shows the pointer's choice when there is one.

  Written as `hovered ?? stage` rather than as one value two things write to. A single
  `active` that both update looks simpler and produces the bug where scrolling a pixel while
  hovering yanks the panel away from the step under the cursor.
*/
export function HowItWorks() {
  const [hovered, setHovered] = useState<number | null>(null);
  const [stage, setStage] = useState(0);
  const head = useInView<HTMLDivElement>();

  /*
    Map scroll progress onto a step index.

    The driver PUSHES progress here — it already runs one rAF loop for the whole page, and it
    only ticks on scroll. An earlier version polled the CSS variable in its own animation
    frame, which burned a frame forever including while the section was off screen. If you
    need a scroll value, subscribe; never poll for it.

    The window is 0.30–0.75 rather than 0–1 because the column enters and leaves the viewport
    at those extremes: unclamped, step 3 would be showing before the section is on screen.
    setStage is called with a guard so unchanged progress does not re-render.
  */
  const handleProgress = useCallback((progress: number) => {
    const span = (progress - 0.3) / 0.45;
    const index = Math.max(0, Math.min(2, Math.floor(span * 3)));
    setStage((prev) => (prev === index ? prev : index));
  }, []);

  const stepsRef = useSectionProgress<HTMLDivElement>(1, handleProgress);

  const active = hovered ?? stage;

  return (
    <section className={`container ${styles.section}`}>
      {/* Only the section heading reveals. The step list and preview are interactive, and
          animating them on scroll would delay the thing the reader came to use. */}
      <div ref={head.ref} className={`${styles.head} ${head.inView ? 'app-enter' : ''}`}>
        <h2 className={styles.title}>How It Works</h2>
      </div>
      <div className={styles.grid}>
        <div ref={stepsRef} className={styles.steps} onMouseLeave={() => setHovered(null)}>
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className={`${styles.step} ${i === active ? styles.stepActive : ''}`}
              onMouseEnter={() => setHovered(i)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
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
          {/* Keyed so a stage change remounts and replays the entrance rather than swapping
              content in place. `app-enter` is the GLOBAL class, not a module rule. */}
          <div key={active} className={`${styles.stage} app-enter`}>
            <StepPreview index={active} />
          </div>
        </div>
      </div>
    </section>
  );
}
