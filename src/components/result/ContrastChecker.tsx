import { useEffect, useMemo, useState } from 'react';
import { assessPairLevel, auditAccessibility, type ContrastPairResult } from '../../engine/accessibility';
import { contrastRatio } from '../../engine/color';
import type { DesignSystemOutput } from '../../engine/types';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';
import result from './result.module.css';
import styles from './ContrastChecker.module.css';

const AA_AA_LARGE: ReadonlySet<ContrastPairResult['level']> = new Set(['AAA', 'AA', 'AA Large']);

/**
 * Live WCAG contrast checking for every meaningful pairing in the generated palette.
 *
 * Reuses `auditAccessibility`'s `contrastPairs` — the same real WCAG 2.1 relative-luminance
 * maths already used by the Accessibility section, not a second implementation. A fix applied
 * here is a local, clearly-labelled override for this view: it never rewrites `output.colors`
 * in GeneratedSystemContext, because that object is shared by every other section (Export,
 * Reasoning, Tokens) and is validated field-for-field against the Python engine — silently
 * mutating it would make an adjusted colour indistinguishable from one the engine chose. See
 * `computeSuggestedFix` in engine/accessibility.ts for why a fix is never a guess.
 */
export function ContrastChecker({ output }: { output: DesignSystemOutput }) {
  const { showToast } = useToast();
  const audit = useMemo(() => auditAccessibility(output), [output]);

  /** hex the user accepted, keyed by pairing label. Reset whenever the palette regenerates. */
  const [applied, setApplied] = useState<Record<string, string>>({});
  useEffect(() => setApplied({}), [output]);

  const pairs = useMemo<ContrastPairResult[]>(
    () =>
      audit.contrastPairs.map((pair) => {
        const overrideHex = applied[pair.label];
        if (!overrideHex) return pair;
        const ratio = contrastRatio(overrideHex, pair.background);
        const passes = ratio !== null && ratio >= pair.required;
        return {
          ...pair,
          foreground: overrideHex,
          ratio,
          level: assessPairLevel(ratio, pair.required),
          status: passes ? 'pass' : ratio !== null && ratio >= 3 ? 'warning' : 'attention',
          suggestedFix: null,
        };
      }),
    [audit, applied],
  );

  const total = pairs.length;
  const aaCount = pairs.filter((p) => p.ratio !== null && p.ratio >= p.required).length;
  const aaaCount = pairs.filter((p) => {
    if (p.ratio === null) return false;
    const aaaTarget = p.required <= 3 ? 4.5 : 7;
    return p.ratio >= aaaTarget;
  }).length;

  const acceptFix = (pair: ContrastPairResult) => {
    if (!pair.suggestedFix) return;
    setApplied((prev) => ({ ...prev, [pair.label]: pair.suggestedFix! }));
    showToast(`Adjusted "${pair.label}" to ${pair.suggestedFix}`, 'success');
  };

  const revertFix = (pair: ContrastPairResult) => {
    setApplied((prev) => {
      const next = { ...prev };
      delete next[pair.label];
      return next;
    });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <p className={result.subheading}>
          Contrast checker
          <Tooltip text="AA is the WCAG minimum most accessibility laws require: 4.5:1 for normal text, 3:1 for large text (18pt+, or 14pt bold) and UI indicators like borders and focus rings. AAA is the stricter, optional standard: 7:1 for normal text, 4.5:1 for large text." />
        </p>
        <p className={styles.summary}>
          {aaCount}/{total} pairings pass AA · {aaaCount}/{total} pass AAA
        </p>
      </div>

      <ul className={styles.list}>
        {pairs.map((pair) => {
          const isApplied = Boolean(applied[pair.label]);
          const tone = AA_AA_LARGE.has(pair.level) ? 'positive' : 'negative';
          const thresholdNote =
            pair.level === 'Fail'
              ? `Fails — needs ${pair.required}:1`
              : pair.level === 'AA Large'
                ? `Meets AA for large text / UI (${pair.required}:1)`
                : pair.required <= 3
                  ? `Meets ${pair.level} for large text / UI`
                  : `Meets ${pair.level} for normal text`;

          return (
            <li key={pair.label} className={styles.row}>
              <div
                className={styles.swatch}
                style={{ background: pair.background, color: pair.foreground }}
                aria-hidden="true"
              >
                Aa
              </div>

              <div className={styles.info}>
                <div className={styles.infoHead}>
                  <span className={styles.label}>{pair.label}</span>
                  <Badge tone={tone}>{pair.level}</Badge>
                  {isApplied && <Badge tone="neutral">Adjusted</Badge>}
                </div>
                <p className={styles.meta}>
                  {pair.ratio !== null ? `${pair.ratio.toFixed(2)}:1` : '—'} · {thresholdNote}
                </p>
              </div>

              {pair.suggestedFix && (
                <div className={styles.fix}>
                  <span className={styles.fixSwatch} style={{ background: pair.suggestedFix }} aria-hidden="true" />
                  <span className={styles.fixHex}>{pair.suggestedFix}</span>
                  <button type="button" className={styles.fixButton} onClick={() => acceptFix(pair)}>
                    Apply fix
                  </button>
                </div>
              )}

              {!pair.suggestedFix && pair.status !== 'pass' && !isApplied && (
                <p className={styles.unfixable}>No shade of this colour reaches the target against this background.</p>
              )}

              {isApplied && (
                <button type="button" className={styles.revertButton} onClick={() => revertFix(pair)}>
                  Revert
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
