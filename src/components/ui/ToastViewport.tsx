import { useToast } from '../../context/ToastContext';
import styles from './ToastViewport.module.css';

export function ToastViewport() {
  const { toasts } = useToast();

  return (
    <div className={styles.viewport} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`${styles.toast} ${toast.tone !== 'default' ? styles[toast.tone] : ''}`}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}
