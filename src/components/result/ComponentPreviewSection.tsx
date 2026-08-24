import { useEffect, useMemo, useState } from 'react';
import { buildModes } from '../../engine/darkMode';
import type { DesignSystemOutput } from '../../engine/types';
import { DesignSystemScope } from './DesignSystemScope';
import { ModeSwitcher } from './ModeSwitcher';
import { Tabs } from '../ui/Tabs';
import ds from './dsPreview.module.css';
import result from './result.module.css';
import styles from './ComponentPreviewSection.module.css';

interface ComponentPreviewSectionProps {
  output: DesignSystemOutput;
}

const STATES = [
  { id: 'default', label: 'Default' },
  { id: 'hover', label: 'Hover' },
  { id: 'active', label: 'Active' },
  { id: 'focus', label: 'Focus' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'error', label: 'Error' },
  { id: 'loading', label: 'Loading' },
];

export function ComponentPreviewSection({ output }: ComponentPreviewSectionProps) {
  const [state, setState] = useState('default');
  const dataState = state === 'default' ? undefined : state;
  const isDisabled = state === 'disabled';

  // Every generated system has both a generated mode and a derived opposite mode (see
  // engine/darkMode.ts) — there is no "this system has no dark mode" case to gate on.
  const modes = useMemo(() => buildModes(output), [output]);
  const [modeIndex, setModeIndex] = useState(() => modes.findIndex((m) => m.isGenerated));
  useEffect(() => {
    setModeIndex(modes.findIndex((m) => m.isGenerated));
  }, [output, modes]);
  const activeMode = modes[modeIndex] ?? modes[0];

  return (
    <section id="components" className={result.section} aria-labelledby="components-heading">
      <h2 id="components-heading" className={result.sectionTitleSpaced}>
        Components
      </h2>
      <p className={result.sectionIntro}>
        Every component below is styled entirely from this system's own tokens — nothing here is hand-tuned per query.
      </p>

      <ModeSwitcher modes={modes} activeIndex={modeIndex} onChange={setModeIndex} />

      <DesignSystemScope output={output} mode={activeMode}>
        <div className={styles.stateBar}>
          <p className={result.subheadingFlush}>Interactive states</p>
          <Tabs items={STATES} activeId={state} onChange={setState} label="Component state" />
        </div>

        <div className={styles.stateDemo}>
          <div className={styles.stateItem}>
            <span className={styles.stateItemLabel}>Button</span>
            <button type="button" className={ds.button} data-state={dataState} disabled={isDisabled} aria-busy={state === 'loading'}>
              {state === 'loading' && <span className={ds.spinner} aria-hidden="true" />}
              Continue
            </button>
          </div>
          <div className={styles.stateItem}>
            <span className={styles.stateItemLabel}>Input</span>
            <input
              className={ds.input}
              data-state={dataState}
              disabled={isDisabled}
              placeholder="you@example.com"
              defaultValue={state === 'error' ? 'not-an-email' : ''}
            />
          </div>
          <div className={styles.stateItem}>
            <span className={styles.stateItemLabel}>Select</span>
            <select className={ds.select} data-state={dataState} disabled={isDisabled} defaultValue="a">
              <option value="a">Option A</option>
              <option value="b">Option B</option>
            </select>
          </div>
        </div>

        <div className={styles.gallery}>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>Buttons</p>
            <div className={styles.row}>
              <button type="button" className={ds.button}>
                Primary
              </button>
              <button type="button" className={`${ds.button} ${ds.buttonSecondary}`}>
                Secondary
              </button>
              <button type="button" className={`${ds.button} ${ds.buttonGhost}`}>
                Ghost
              </button>
            </div>
          </div>

          <div className={styles.tile}>
            <p className={styles.tileLabel}>Checkbox &amp; Radio</p>
            <div className={styles.tileBody}>
              <label className={ds.checkRow}>
                <input type="checkbox" className={ds.checkbox} defaultChecked /> Remember me
              </label>
              <label className={ds.checkRow}>
                <input type="radio" className={ds.radio} name="preview-radio" defaultChecked /> Monthly
              </label>
              <label className={ds.checkRow}>
                <input type="radio" className={ds.radio} name="preview-radio" /> Annual
              </label>
            </div>
          </div>

          <div className={styles.tile}>
            <p className={styles.tileLabel}>Card</p>
            <div className={ds.card}>
              <p className={ds.tileHeading}>Monthly summary</p>
              <p className={ds.tileSub}>Generated from this system's card token.</p>
            </div>
          </div>

          <div className={styles.tile}>
            <p className={styles.tileLabel}>Badges</p>
            <div className={styles.row}>
              <span className={ds.badge}>New</span>
              <span className={`${ds.badge} ${ds.badgeMuted}`}>Draft</span>
            </div>
          </div>

          <div className={styles.tile}>
            <p className={styles.tileLabel}>Alerts</p>
            <div className={styles.tileBody}>
              <div className={ds.alert}>Your changes were saved.</div>
              <div className={`${ds.alert} ${ds.alertError}`}>Something needs your attention.</div>
            </div>
          </div>

          <div className={styles.tile}>
            <p className={styles.tileLabel}>Navigation</p>
            <nav className={ds.navRow} aria-label="Preview navigation">
              <span className={ds.navItemActive}>Overview</span>
              <span>Activity</span>
              <span>Settings</span>
            </nav>
          </div>

          <div className={styles.tile}>
            <p className={styles.tileLabel}>Tabs</p>
            <div className={ds.tabRow} role="tablist" aria-label="Preview tabs">
              <span className={`${ds.tab} ${ds.tabActive}`} role="tab" aria-selected="true">
                Daily
              </span>
              <span className={ds.tab} role="tab" aria-selected="false">
                Weekly
              </span>
            </div>
          </div>

          <div className={styles.tile}>
            <p className={styles.tileLabel}>Modal</p>
            <div className={ds.modal}>
              <p className={ds.tileHeading}>Confirm action</p>
              <p className={ds.tileSubSpaced}>This can't be undone.</p>
              <button type="button" className={ds.button}>
                Confirm
              </button>
            </div>
          </div>

          <div className={styles.tile}>
            <p className={styles.tileLabel}>Dropdown</p>
            <select className={ds.select} defaultValue="recent">
              <option value="recent">Most recent</option>
              <option value="popular">Most popular</option>
            </select>
          </div>

          <div className={styles.tile}>
            <p className={styles.tileLabel}>Table</p>
            <table className={ds.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Onboarding</td>
                  <td>Active</td>
                </tr>
                <tr>
                  <td>Billing</td>
                  <td>Pending</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={styles.tile}>
            <p className={styles.tileLabel}>Avatar</p>
            <div className={styles.row}>
              <span className={ds.avatar}>AK</span>
              <span className={ds.avatar}>JD</span>
            </div>
          </div>

          <div className={styles.tile}>
            <p className={styles.tileLabel}>Tooltip</p>
            <span className={ds.tooltip}>Saved to drafts</span>
          </div>
        </div>
      </DesignSystemScope>
    </section>
  );
}
