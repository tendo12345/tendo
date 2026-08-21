import { useState } from 'react';
import {
  auditImportedTokens,
  importTokens,
  type ImportFinding,
  type ImportResult,
} from '../../engine/importSystem';
import result from '../result/result.module.css';
import styles from './ImportPane.module.css';

const SEVERITY_LABEL: Record<ImportFinding['severity'], string> = {
  info: 'OK',
  warning: 'Warning',
  attention: 'Needs attention',
};

const FORMAT_LABEL: Record<string, string> = {
  css: 'CSS custom properties',
  json: 'JSON',
  w3c: 'W3C design tokens',
  tailwind: 'Tailwind theme',
  unknown: 'Unrecognised',
};

/**
 * Import and audit an existing token set.
 *
 * The audit is arithmetic on the values pasted in — duplicates, broken scales, contrast,
 * missing roles. It offers no opinion on naming or taste, and it does not analyse
 * screenshots or components: that needs vision this tool does not have, and the panel says
 * so rather than shipping a box that pretends.
 */
export function ImportPane() {
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState<ImportResult | null>(null);
  const [findings, setFindings] = useState<ImportFinding[] | null>(null);

  const analyse = () => {
    const res = importTokens(raw);
    setParsed(res);
    setFindings(res.tokens.length > 0 ? auditImportedTokens(res.tokens) : null);
  };

  return (
    <section aria-labelledby="import-heading" className={result.section}>
      <h2 id="import-heading" className={result.sectionTitleSpaced}>
        Import a system
      </h2>
      <p className={result.sectionIntro}>
        Paste CSS custom properties, a JSON token file, a W3C design-token file, or a Tailwind
        theme block. Basis parses it and reports what it can measure.
      </p>

      <label className={styles.label} htmlFor="import-input">
        Tokens
      </label>
      <textarea
        id="import-input"
        className={styles.textarea}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={10}
        spellCheck={false}
        placeholder={':root {\n  --color-primary: #2563EB;\n  --space-md: 16px;\n}'}
      />

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          onClick={analyse}
          disabled={raw.trim().length === 0}
        >
          Analyse
        </button>
        {parsed && (
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              setRaw('');
              setParsed(null);
              setFindings(null);
            }}
          >
            Clear
          </button>
        )}
      </div>

      {parsed?.error && <p className={styles.error}>{parsed.error}</p>}

      {parsed && !parsed.error && (
        <>
          <div className={styles.summary}>
            <span>
              Read as <strong>{FORMAT_LABEL[parsed.format]}</strong>
            </span>
            <span>{parsed.tokens.length} tokens</span>
            {parsed.skipped > 0 && (
              <span className={styles.skipped}>
                {parsed.skipped} non-token declarations ignored
              </span>
            )}
          </div>

          {findings && findings.length > 0 && (
            <ul className={styles.findings}>
              {findings.map((f) => (
                <li key={f.id} className={styles.finding}>
                  <div className={styles.findingHead}>
                    <p className={styles.findingTitle}>{f.title}</p>
                    <span className={`${styles.severity} ${styles[f.severity]}`}>
                      {SEVERITY_LABEL[f.severity]}
                    </span>
                  </div>
                  <p className={styles.detail}>{f.detail}</p>
                  {f.tokens.length > 0 && (
                    <ul className={styles.tokenList}>
                      {f.tokens.slice(0, 12).map((t) => (
                        <li key={t}>
                          <code>{t}</code>
                        </li>
                      ))}
                      {f.tokens.length > 12 && <li className={styles.more}>and {f.tokens.length - 12} more</li>}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className={styles.notBuilt}>
        <p className={styles.notBuiltTitle}>Not built yet</p>
        <p className={styles.notBuiltBody}>
          Comparing an imported system against your generated one, and analysing a screenshot or
          a React component for token violations, are both planned. Neither is implemented.
          Screenshot analysis in particular needs image understanding that Basis does not have,
          so there is no upload box here pretending otherwise.
        </p>
      </div>
    </section>
  );
}
