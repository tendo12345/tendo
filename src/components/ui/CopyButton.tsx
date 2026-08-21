import { copyToClipboard } from '../../lib/clipboard';
import { useToast } from '../../context/ToastContext';
import styles from './CopyButton.module.css';

interface CopyButtonProps {
  value: string;
  label?: string;
  successMessage?: string;
  className?: string;
}

export function CopyButton({ value, label = 'Copy', successMessage, className = '' }: CopyButtonProps) {
  const { showToast } = useToast();

  const handleClick = async () => {
    const ok = await copyToClipboard(value);
    showToast(ok ? successMessage ?? 'Copied' : 'Could not copy — try selecting the text manually', ok ? 'success' : 'error');
  };

  return (
    <button type="button" className={`${styles.copy} ${className}`} onClick={handleClick}>
      {label}
    </button>
  );
}
