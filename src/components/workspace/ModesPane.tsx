import { useMemo, useState } from 'react';
import { buildModes } from '../../engine/darkMode';
import { contrastRatio, wcagLevel } from '../../engine/color';
import type { DesignSystemOutput } from '../../engine/types';
import { ModeSwitcher } from '../result/ModeSwitcher';
import result from '../result/result.module.css';
import styles from './ModesPane.module.css';

/**
 * Light and dark.
 *
 * The engine generates one palette. The other mode is rebuilt around a neutral ground
 * with the brand hues preserved — not inverted, which would wreck both the hue
 * relationships and the contrast. The derived mode is labelled everywhere it appears.
 */
export function ModesPane({ output }: { output: DesignSystemOutput }) {
  const modes = useMemo(() => buildModes(output), [output]);
  const [active, setActive] = useState(() => modes.findIndex((m) => m.isGenerated));

  const mode = modes[active] ?? modes[0];
  const colors = mode.tokens.filter((t) => t.group === 'color');
  const bg = colors.find((t) => t.name === 'color.surface.default')?.value ?? '#fff';
  const raised = colors.find((t) => t.name === 'color.surface.raised')?.value ?? bg;
  const text = colors.find((t) => t.name === 'color.text.primary')?.value ?? '#000';
  const muted = colors.find((t) => t.name === 'color.text.muted')?.value ?? text;
  const primary = colors.find((t) => t.name === 'color.action.primary')?.value ?? '#000';
  const onPrimary = colors.find((t) => t.name === 'color.action.on-primary')?.value ?? '#fff';
  const border = colors.find((t) => t.name === 'color.border.default')?.value ?? '#ccc';

  return (
    <section aria-labelledby="modes-heading" className={result.section}>
      <h2 id="modes-heading" className={result.sectionTitleSpaced}>
        Light and dark
      </h2>

      <ModeSwitcher modes={modes} activeIndex={active} onChange={setActive} />

      <p className={`${styles.provenance} ${mode.isGenerated ? '' : styles.provenanceDerived}`}>
        {mode.provenanceNote}
      </p>

      <div className={styles.preview} style={{ background: bg, borderColor: border }}>
        <div className={styles.previewCard} style={{ background: raised, borderColor: border }}>
          <p className={styles.previewHeading} style={{ color: text, fontFamily: `'${output.typography.heading}', sans-serif` }}>
            {output.category}
          </p>
          <p className={styles.previewBody} style={{ color: muted, fontFamily: `'${output.typography.body}', sans-serif` }}>
            A design system turns one-off decisions into a repeatable set of defaults.
          </p>
          <span
            className={styles.previewButton}
            style={{
              background: primary,
              color: onPrimary,
              borderRadius: output.components.button.radius,
              padding: output.components.button.padding,
              fontFamily: `'${output.typography.body}', sans-serif`,
            }}
          >
            Continue
          </span>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Token</th>
              <th scope="col">Value</th>
              <th scope="col">Origin</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {colors.map((t) => {
              const ratio = t.name.startsWith('color.text') ? contrastRatio(t.value, bg) : null;
              return (
                <tr key={t.name}>
                  <th scope="row" className={styles.tokenName}>
                    {t.name}
                  </th>
                  <td>
                    <span className={styles.swatch} style={{ background: t.value }} />
                    <code>{t.value}</code>
                    {ratio && <span className={styles.ratio}> {ratio.toFixed(2)}:1 {wcagLevel(ratio)}</span>}
                  </td>
                  <td>
                    <span className={`${styles.origin} ${styles[t.origin]}`}>{t.origin}</span>
                  </td>
                  <td className={styles.source}>{t.source}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
