import styles from './ExamplePrompts.module.css';

export const EXAMPLE_PROMPTS = [
  'Fintech mobile app for young professionals',
  'Minimal portfolio for a product designer',
  'Dark analytics dashboard for SaaS',
  'Premium fashion e-commerce website',
  'Friendly healthcare appointment app',
  'Sports community platform',
];

interface ExamplePromptsProps {
  onSelect: (prompt: string) => void;
}

export function ExamplePrompts({ onSelect }: ExamplePromptsProps) {
  return (
    <div className={styles.wrap}>
      <p className={styles.label}>Or try an example</p>
      <div className={styles.list}>
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button key={prompt} type="button" className={styles.prompt} onClick={() => onSelect(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
