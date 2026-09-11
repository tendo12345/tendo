import { useMemo, useState } from 'react';
import { DIRECTIONS, compareSystems, createVariation, type Variation } from '../../engine/variations';
import type { DesignSystemOutput } from '../../engine/types';
import { useGenerate } from '../../hooks/useGenerate';
import { useToast } from '../../context/ToastContext';
import { fingerprint, useSystemStore } from '../../context/SystemStoreContext';
import { detectDrift } from '../../lib/systemStore';
import { buildShareUrl } from '../../lib/shareLink';
import { copyToClipboard } from '../../lib/clipboard';
import result from '../result/result.module.css';
import styles from './ExplorePane.module.css';

/**
 * Directions, comparison and version history.
 *
 * A direction re-runs the engine with extra style keywords rather than post-processing the
 * result, so a variation is a real generated system and not a filter. When a direction
 * changes nothing, that is reported plainly instead of being disguised.
 */
export function ExplorePane({ output }: { output: DesignSystemOutput }) {
  const { generate } = useGenerate();
  const { showToast } = useToast();
  const [variations, setVariations] = useState<Variation[]>([]);
  const [compareWith, setCompareWith] = useState<DesignSystemOutput | null>(null);
  const { systems, info, loading, saveCurrent, remove: removeSystem } = useSystemStore();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const current = useMemo(() => fingerprint(output), [output]);

  const comparison = useMemo(
    () => (compareWith ? compareSystems(output, compareWith) : null),
    [output, compareWith],
  );

  const explore = (directionId: string) => {
    const direction = DIRECTIONS.find((d) => d.id === directionId);
    if (!direction) return;
    if (variations.some((v) => v.direction.id === directionId)) return;
    const variation = createVariation(output, direction);
    setVariations((prev) => [...prev, variation]);
  };

  const adopt = (variation: Variation) => {
    generate(variation.input);
    showToast(`Now working from "${variation.direction.label}"`, 'success');
  };

  const snapshot = async () => {
    setSaving(true);
    const saved = await saveCurrent(output, note);
    setSaving(false);
    if (!saved) {
      showToast('Could not save', 'error');
      return;
    }
    setNote('');
    showToast(`Saved "${saved.name}"`, 'success');
  };

  const share = async () => {
    const ok = await copyToClipboard(buildShareUrl(output.input));
    showToast(ok ? 'Share link copied' : 'Could not copy', ok ? 'success' : 'error');
  };

  return (
    <section aria-labelledby="explore-heading" className={result.section}>
      <h2 id="explore-heading" className={result.sectionTitleSpaced}>
        Explore Directions
      </h2>
      <p className={result.sectionIntro}>
        Each direction re-runs the engine with extra style keywords, so what comes back was
        selected the same way your original was. Your current system is never modified.
      </p>

      <div className={styles.directions}>
        {DIRECTIONS.map((d) => {
          const used = variations.some((v) => v.direction.id === d.id);
          return (
            <button
              key={d.id}
              type="button"
              className={styles.directionButton}
              onClick={() => explore(d.id)}
              disabled={used}
              title={d.description}
            >
              {d.label}
              {used && <span className={styles.done}>✓</span>}
            </button>
          );
        })}
      </div>

      {variations.length > 0 && (
        <ul className={styles.variations}>
          {variations.map((v) => (
            <li key={v.id} className={styles.variation}>
              <div className={styles.variationHead}>
                <div>
                  <p className={styles.variationLabel}>{v.direction.label}</p>
                  <p className={styles.variationStyle}>
                    {v.output.style.name} · {v.output.category}
                  </p>
                </div>
                <div className={styles.variationActions}>
                  <button type="button" className={styles.smallButton} onClick={() => setCompareWith(v.output)}>
                    Compare
                  </button>
                  <button
                    type="button"
                    className={`${styles.smallButton} ${styles.primaryButton}`}
                    onClick={() => adopt(v)}
                    disabled={v.unchanged}
                  >
                    Use this version
                  </button>
                </div>
              </div>

              <p className={v.unchanged ? styles.outcomeFlat : styles.outcome}>{v.outcome}</p>

              {v.changes.length > 0 && (
                <ul className={styles.changes}>
                  {v.changes.map((c) => (
                    <li key={c.field} className={styles.change}>
                      <span className={styles.changeField}>{c.field}</span>
                      <span className={styles.changeBefore}>{c.before}</span>
                      <span aria-hidden="true" className={styles.arrow}>→</span>
                      <span className={styles.changeAfter}>{c.after}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {comparison && (
        <>
          <h3 className={styles.subTitle}>Comparison</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Current</th>
                  <th scope="col">Variation</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.field} className={row.same ? styles.rowSame : styles.rowDiff}>
                    <th scope="row">{row.field}</th>
                    <td>{row.a}</td>
                    <td>{row.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className={styles.smallButton} onClick={() => setCompareWith(null)}>
            Close comparison
          </button>
        </>
      )}

      <h3 className={styles.subTitle}>Saved Systems</h3>
      <p className={styles.historyNote}>
        {info.description} Only the description you typed is stored — the system is rebuilt
        from it, so a saved system never goes stale as the engine improves.
      </p>

      <div className={styles.saveRow}>
        <label className={styles.saveLabel} htmlFor="snapshot-note">
          Name (optional)
        </label>
        <input
          id="snapshot-note"
          type="text"
          className={styles.saveInput}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Accessibility pass"
        />
        <button
          type="button"
          className={`${styles.smallButton} ${styles.primaryButton}`}
          onClick={() => void snapshot()}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save system'}
        </button>
        <button type="button" className={styles.smallButton} onClick={() => void share()}>
          Copy share link
        </button>
      </div>

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : systems.length === 0 ? (
        <p className={styles.empty}>Nothing saved yet.</p>
      ) : (
        <ul className={styles.snapshots}>
          {systems.map((s) => {
            const drift = detectDrift(s, current);
            return (
              <li key={s.id} className={styles.snapshot}>
                <div>
                  <p className={styles.snapshotLabel}>{s.name}</p>
                  <p className={styles.snapshotMeta}>
                    &ldquo;{[s.input.productType, ...(s.input.keywords ?? [])].join(' ')}&rdquo; ·{' '}
                    {new Date(s.createdAt).toLocaleString()}
                    {drift === 'changed' && (
                      // Only flagged where the engine actually moved this system. Warning on
                      // every release, including ones that changed nothing here, would be noise.
                      <span className={styles.drift}> · rebuilt differently since you saved it</span>
                    )}
                  </p>
                </div>
                <div className={styles.variationActions}>
                  <button
                    type="button"
                    className={styles.smallButton}
                    onClick={() => {
                      generate(s.input);
                      showToast(`Opened "${s.name}"`, 'success');
                    }}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className={styles.smallButton}
                    onClick={() => void (async () => {
                      const ok = await copyToClipboard(buildShareUrl(s.input));
                      showToast(ok ? 'Share link copied' : 'Could not copy', ok ? 'success' : 'error');
                    })()}
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    className={styles.smallButton}
                    onClick={() => void removeSystem(s.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
