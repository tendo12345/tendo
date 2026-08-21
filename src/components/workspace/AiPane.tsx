import { useMemo, useState } from 'react';
import {
  BUILD_TARGETS,
  buildAiContext,
  buildBasisMarkdown,
  buildImplementationPrompt,
  type BuildTarget,
} from '../../engine/aiContext';
import type { DesignSystemOutput } from '../../engine/types';
import { useToast } from '../../context/ToastContext';
import { copyToClipboard, downloadFile } from '../../lib/clipboard';
import result from '../result/result.module.css';
import styles from './AiPane.module.css';

type Tab = 'context' | 'basis' | 'prompt';

/**
 * Output for coding agents.
 *
 * These are text generators. Basis has no integration with Claude Code, Cursor, v0 or
 * anything else — the copy here says so, because implying a live connection would be a
 * straightforward lie about what the product does.
 */
export function AiPane({ output }: { output: DesignSystemOutput }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('context');
  const [target, setTarget] = useState<BuildTarget>('landing');
  const [customBrief, setCustomBrief] = useState('');

  const context = useMemo(() => buildAiContext(output), [output]);
  const basisMd = useMemo(() => buildBasisMarkdown(output), [output]);
  const prompt = useMemo(
    () => buildImplementationPrompt(output, target, customBrief),
    [output, target, customBrief],
  );

  const current = tab === 'context' ? context : tab === 'basis' ? basisMd : prompt;

  const copy = async () => {
    const ok = await copyToClipboard(current);
    showToast(ok ? 'Copied' : 'Could not copy', ok ? 'success' : 'error');
  };

  return (
    <section aria-labelledby="ai-heading" className={result.section}>
      <h2 id="ai-heading" className={result.sectionTitleSpaced}>
        Build with AI
      </h2>
      <p className={result.sectionIntro}>
        Text you paste into a coding agent so it builds against this system instead of
        inventing its own. Basis does not connect to any of these tools — this is copy and
        paste, nothing more.
      </p>

      <div className={styles.tabs} role="tablist" aria-label="Output format">
        {(
          [
            ['context', 'AI context'],
            ['basis', 'BASIS.md'],
            ['prompt', 'Build prompt'],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <p className={styles.blurb}>
        {tab === 'context' &&
          'A compact block for a chat window. Carries every token, the layout pattern and the rules that stop an agent drifting.'}
        {tab === 'basis' &&
          'Commit this at the root of your repo. Agents that read the project will treat it as the design source of truth.'}
        {tab === 'prompt' &&
          'A full implementation brief for one kind of screen, with the whole system inlined.'}
      </p>

      {tab === 'prompt' && (
        <div className={styles.targetRow}>
          <label className={styles.targetLabel} htmlFor="build-target">
            Build
          </label>
          <select
            id="build-target"
            className={styles.select}
            value={target}
            onChange={(e) => setTarget(e.target.value as BuildTarget)}
          >
            {BUILD_TARGETS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {target === 'custom' && (
            <input
              type="text"
              className={styles.customInput}
              value={customBrief}
              onChange={(e) => setCustomBrief(e.target.value)}
              placeholder="Describe what to build"
              aria-label="Custom build brief"
            />
          )}
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={`${styles.button} ${styles.primary}`} onClick={copy}>
          Copy
        </button>
        {tab === 'basis' && (
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              downloadFile('BASIS.md', basisMd, 'text/markdown');
              showToast('BASIS.md downloaded', 'success');
            }}
          >
            Download BASIS.md
          </button>
        )}
        <span className={styles.size}>{current.split('\n').length} lines</span>
      </div>

      <pre className={styles.output}>
        <code>{current}</code>
      </pre>
    </section>
  );
}
