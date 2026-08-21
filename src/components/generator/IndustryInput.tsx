import { Chip } from '../ui/Chip';
import { Tooltip } from '../ui/Tooltip';
import styles from './GeneratorForm.module.css';

const SUGGESTED_INDUSTRIES = [
  'Fintech',
  'Healthcare',
  'Education',
  'Fashion',
  'Sports',
  'Technology',
  'Food',
  'Real Estate',
  'Media',
  'Finance',
  'Web3',
];

interface IndustryInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function IndustryInput({ value, onChange }: IndustryInputProps) {
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor="industry">
          Industry <span className={styles.optional}>(optional)</span>
        </label>
        <Tooltip text="Blended into the same search as the product description — there's no separate industry dataset, so this is free text." />
      </div>
      <input
        id="industry"
        type="text"
        className={styles.input}
        placeholder="e.g. Healthcare"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className={styles.chipRow}>
        {SUGGESTED_INDUSTRIES.map((label) => (
          <Chip key={label} onClick={() => onChange(label)} selected={value === label}>
            {label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
