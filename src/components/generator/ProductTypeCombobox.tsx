import { matchProductTypes, PRODUCT_TYPES } from '../../lib/productTypes';
import { Chip } from '../ui/Chip';
import { Tooltip } from '../ui/Tooltip';
import styles from './GeneratorForm.module.css';

const QUICK_PICKS = [
  'SaaS',
  'Mobile App',
  'Website',
  'Dashboard',
  'E-commerce',
  'Portfolio',
  'Fintech',
  'Healthcare',
  'Education',
  'Social',
  'Marketplace',
];

interface ProductTypeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function ProductTypeCombobox({ value, onChange, error }: ProductTypeComboboxProps) {
  const handleQuickPick = (label: string) => {
    const [match] = matchProductTypes(label, 1);
    onChange(match ?? label);
  };

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor="product-type">
          What are you building?
        </label>
        <Tooltip text={`Matched against ${PRODUCT_TYPES.length} real product categories the engine knows — free text works too.`} />
      </div>
      <p className={styles.helper}>Start with the product and audience. Example: "A fintech app for university students."</p>
      <input
        id="product-type"
        type="text"
        className={styles.textarea}
        placeholder="Example: A mobile banking app for young professionals"
        list="product-type-options"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'product-type-error' : undefined}
        autoComplete="off"
      />
      <datalist id="product-type-options">
        {PRODUCT_TYPES.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
      {error && (
        <p id="product-type-error" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.chipRow}>
        {QUICK_PICKS.map((label) => (
          <Chip key={label} onClick={() => handleQuickPick(label)}>
            {label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
