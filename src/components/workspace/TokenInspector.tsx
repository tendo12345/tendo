import { useEffect, useRef } from 'react';
import type { SemanticToken } from '../../engine/semanticTokens';
import { copyToClipboard } from '../../lib/clipboard';
import { useToast } from '../../context/ToastContext';
import styles from './TokenInspector.module.css';

const ORIGIN_COPY: Record<SemanticToken['origin'], string> = {
  generated: 'Generated — the engine selected this value for your product.',
  derived: 'Derived — computed from a generated value, not chosen independently.',
  default: 'Basis default — the dataset has no value for this role.',
};

interface TokenInspectorProps {
  token: SemanticToken;
  onClose: () => void;
}

/** Detail view for one token: what it is, where it came from, and where it is used. */
export function TokenInspector({ token, onClose }: TokenInspectorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isColor = token.group === 'color';

  const copy = async (label: string, text: string) => {
    const ok = await copyToClipboard(text);
    showToast(ok ? `${label} copied` : 'Could not copy', ok ? 'success' : 'error');
  };

  const cssVarName = `--${token.name.replace(/\./g, '-')}`;

  return (
    <div
      className={styles.panel}
      ref={ref}
      role="dialog"
      aria-label={`Token ${token.name}`}
      aria-modal="false"
    >
      <div className={styles.head}>
        <div className={styles.title}>
          {isColor && <span className={styles.swatch} style={{ background: token.value }} />}
          <div>
            <p className={styles.name}>{token.name}</p>
            <p className={styles.value}>{token.value}</p>
          </div>
        </div>
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close inspector">
          ×
        </button>
      </div>

      <dl className={styles.meta}>
        <div className={styles.metaRow}>
          <dt>Role</dt>
          <dd>{token.role}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>Origin</dt>
          <dd>
            <span className={`${styles.origin} ${styles[token.origin]}`}>{token.origin}</span>
            <span className={styles.originNote}>{ORIGIN_COPY[token.origin]}</span>
          </dd>
        </div>
        <div className={styles.metaRow}>
          <dt>Source</dt>
          <dd className={styles.mono}>{token.source}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>Used by</dt>
          <dd>
            <ul className={styles.usedBy}>
              {token.usedBy.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>

      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={() => copy('Value', token.value)}>
          Copy value
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => copy('CSS', `${cssVarName}: ${token.value};`)}
        >
          Copy CSS
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => copy('JSON', JSON.stringify({ [token.name]: token.value }, null, 2))}
        >
          Copy JSON
        </button>
      </div>
    </div>
  );
}
