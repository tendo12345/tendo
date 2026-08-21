import type { DesignSystemOutput } from '../../engine/types';
import { copyToClipboard } from '../../lib/clipboard';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import styles from './ResultHeader.module.css';

interface ResultHeaderProps {
  output: DesignSystemOutput;
  generatedAt: string | null;
  onRegenerate: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Just now';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return 'Just now';
  }
}

export function ResultHeader({ output, generatedAt, onRegenerate }: ResultHeaderProps) {
  const { showToast } = useToast();

  const handleCopySummary = async () => {
    const summary = `${output.project_name}\nCategory: ${output.category}\nStyle: ${output.style.name}\nPrimary: ${output.colors.primary}\nHeading font: ${output.typography.heading}\nBody font: ${output.typography.body}`;
    const ok = await copyToClipboard(summary);
    showToast(ok ? 'Summary copied' : 'Could not copy', ok ? 'success' : 'error');
  };

  const scrollToExport = () => {
    document.getElementById('export')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={`${styles.header} container`}>
      <div className={styles.top}>
        <div className={styles.meta}>
          <p className={styles.eyebrow}>Your Design System</p>
          <h1 className={styles.title}>{output.category}</h1>
          <p className={styles.description}>"{output.input.productType}"</p>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={onRegenerate}>
            Regenerate
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCopySummary}>
            Copy
          </Button>
          <Button variant="accent" size="sm" onClick={scrollToExport}>
            Export
          </Button>
        </div>
      </div>

      <div className={styles.factRow}>
        <div className={styles.fact}>
          <span className={styles.factLabel}>Product type</span>
          <span className={styles.factValue}>{output.category}</span>
        </div>
        {output.input.industry && (
          <div className={styles.fact}>
            <span className={styles.factLabel}>Industry</span>
            <span className={styles.factValue}>{output.input.industry}</span>
          </div>
        )}
        <div className={styles.fact}>
          <span className={styles.factLabel}>Generated</span>
          <span className={styles.factValue}>{formatDate(generatedAt)}</span>
        </div>
        {output.input.keywords.length > 0 && (
          <div className={styles.fact}>
            <span className={styles.factLabel}>Keywords</span>
            <div className={styles.keywordRow}>
              {output.input.keywords.map((kw) => (
                <Chip key={kw}>{kw}</Chip>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
