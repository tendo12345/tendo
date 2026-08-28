import { useMemo, useState } from 'react';
import { buildComponentStates, type StateName } from '../../engine/componentStates';
import { contrastRatio, wcagLevel } from '../../engine/color';
import type { DesignSystemOutput } from '../../engine/types';
import result from '../result/result.module.css';
import styles from './StatesPane.module.css';

const STATES: StateName[] = ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'success', 'error'];

/**
 * Component states.
 *
 * The engine generates one resting appearance; these states are derived from it by rule.
 * Each one shows the rule that produced it and its live contrast ratio, so a state that
 * trades legibility for the right look is visible rather than buried.
 */
export function StatesPane({ output }: { output: DesignSystemOutput }) {
  const components = useMemo(() => buildComponentStates(output), [output]);
  const [state, setState] = useState<StateName>('default');

  return (
    <section aria-labelledby="states-heading" className={result.section}>
      <h2 id="states-heading" className={result.sectionTitleSpaced}>
        Component States
      </h2>
      <p className={result.sectionIntro}>
        Derived from the resting appearance the engine generated — the dataset carries no
        per-state values. Every state below shows the rule behind it and its measured contrast.
      </p>

      <div className={styles.selector} role="group" aria-label="Component state">
        {STATES.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.stateButton} ${s === state ? styles.stateActive : ''}`}
            aria-pressed={s === state}
            onClick={() => setState(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {components.map((c) => {
          const style = c.states[state];
          const ratio = contrastRatio(style.foreground, style.background);
          const target = state === 'disabled' ? 3 : 4.5;
          const ok = (ratio ?? 0) >= target;

          return (
            <div key={c.component} className={styles.card}>
              <div className={styles.cardHead}>
                <p className={styles.componentName}>{c.component}</p>
                <span className={`${styles.ratio} ${ok ? styles.ratioOk : styles.ratioLow}`}>
                  {ratio ? `${ratio.toFixed(2)}:1` : '—'} · {wcagLevel(ratio)}
                </span>
              </div>

              <div
                className={styles.stage}
                style={{ background: output.colors.background }}
              >
                {c.component === 'Button' ? (
                  <span
                    className={styles.previewButton}
                    style={{
                      background: style.background,
                      color: style.foreground,
                      border: `1px solid ${style.border}`,
                      borderRadius: output.components.button.radius,
                      padding: output.components.button.padding,
                      fontWeight: Number(output.components.button.fontWeight),
                      outline: style.outline,
                      outlineOffset: style.outline ? '2px' : undefined,
                      fontFamily: `'${output.typography.body}', sans-serif`,
                    }}
                  >
                    {state === 'loading' ? 'Working…' : state === 'success' ? 'Saved' : state === 'error' ? 'Failed' : 'Continue'}
                  </span>
                ) : (
                  <span
                    className={styles.previewInput}
                    style={{
                      background: style.background,
                      color: style.foreground,
                      border: `1px solid ${style.border}`,
                      borderRadius: output.components.input.radius,
                      padding: output.components.input.padding,
                      outline: style.outline,
                      outlineOffset: style.outline ? '2px' : undefined,
                      fontSize: output.components.input.fontSize,
                      fontFamily: `'${output.typography.body}', sans-serif`,
                    }}
                  >
                    {state === 'disabled' ? 'Unavailable' : 'name@example.com'}
                  </span>
                )}
              </div>

              <p className={styles.note}>{style.note}</p>

              <dl className={styles.values}>
                <div>
                  <dt>Background</dt>
                  <dd>
                    <span className={styles.swatch} style={{ background: style.background }} />
                    {style.background}
                  </dd>
                </div>
                <div>
                  <dt>Text</dt>
                  <dd>
                    <span className={styles.swatch} style={{ background: style.foreground }} />
                    {style.foreground}
                  </dd>
                </div>
                <div>
                  <dt>Border</dt>
                  <dd>
                    <span className={styles.swatch} style={{ background: style.border }} />
                    {style.border}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      {state === 'error' || state === 'success' ? (
        <p className={styles.caution}>
          Colour alone must not carry this meaning. Pair it with an icon and a message so it is
          perceivable without colour vision.
        </p>
      ) : null}
    </section>
  );
}
