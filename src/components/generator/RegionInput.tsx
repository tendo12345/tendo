import { Tooltip } from '../ui/Tooltip';
import styles from './GeneratorForm.module.css';

interface RegionInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function RegionInput({ value, onChange }: RegionInputProps) {
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor="region">
          Region <span className={styles.optional}>(optional)</span>
        </label>
        <Tooltip text="Reserved for a future emerging-market preset. It's saved with your system but doesn't change the generated result yet." />
      </div>
      <p className={styles.helper}>Doesn't affect this system's colors or type yet — it's recorded for a future regional preset.</p>
      <input
        id="region"
        type="text"
        className={styles.input}
        placeholder="e.g. Southeast Asia"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
