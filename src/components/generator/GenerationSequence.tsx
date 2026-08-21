import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import styles from './GenerationSequence.module.css';

const STEPS = [
  'Understanding product type',
  'Matching design direction',
  'Selecting palette',
  'Selecting typography',
  'Building design tokens',
  'Preparing system',
];

const STEP_DURATION_MS = 220;

interface GenerationSequenceProps {
  onComplete: () => void;
}

export function GenerationSequence({ onComplete }: GenerationSequenceProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (reducedMotion) {
      onCompleteRef.current();
      return;
    }
    if (stepIndex >= STEPS.length - 1) {
      const timeout = setTimeout(() => onCompleteRef.current(), STEP_DURATION_MS);
      return () => clearTimeout(timeout);
    }
    const timeout = setTimeout(() => setStepIndex((i) => i + 1), STEP_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [stepIndex, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <ul className={styles.list}>
        {STEPS.map((step, i) => (
          <li
            key={step}
            className={`${styles.step} ${i <= stepIndex ? styles.done : ''} ${i === stepIndex ? styles.current : ''}`}
          >
            <span className={styles.dot} aria-hidden="true" />
            {step}
          </li>
        ))}
      </ul>
    </div>
  );
}
