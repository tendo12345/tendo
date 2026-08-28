import { useMemo, useState } from 'react';
import {
  buildComponentTokenMap,
  buildSemanticTokens,
  groupTokens,
  type SemanticToken,
} from '../../engine/semanticTokens';
import type { DesignSystemOutput } from '../../engine/types';
import result from '../result/result.module.css';
import { TokenInspector } from './TokenInspector';
import styles from './TokensPane.module.css';

const GROUP_LABELS: Record<string, string> = {
  color: 'Color',
  font: 'Typography',
  space: 'Spacing',
  radius: 'Radius',
  shadow: 'Shadow',
  motion: 'Motion',
};

/**
 * Semantic tokens with an inspector.
 *
 * The semantic layer renames and organises the generated values; it never re-picks them.
 * Each token shows its origin so a derived or defaulted value is never mistaken for one
 * the engine chose for this product.
 */
export function TokensPane({ output }: { output: DesignSystemOutput }) {
  const tokens = useMemo(() => buildSemanticTokens(output), [output]);
  const grouped = useMemo(() => groupTokens(tokens), [tokens]);
  const componentMap = useMemo(() => buildComponentTokenMap(output), [output]);
  const [selected, setSelected] = useState<SemanticToken | null>(null);

  const derivedCount = tokens.filter((t) => t.origin !== 'generated').length;

  return (
    <section aria-labelledby="tokens-heading" className={result.section}>
      <h2 id="tokens-heading" className={result.sectionTitleSpaced}>
        Tokens
      </h2>
      <p className={result.sectionIntro}>
        Semantic roles mapped onto the generated values. {tokens.length} tokens, of which{' '}
        {derivedCount} are derived or Basis defaults rather than values the engine chose for your
        product — each one says which it is. Select any token to inspect it.
      </p>

      <div className={styles.layout}>
        <div className={styles.groups}>
          {grouped.map(([group, list]) => (
            <div key={group} className={styles.group}>
              <h3 className={styles.groupTitle}>{GROUP_LABELS[group] ?? group}</h3>
              <ul className={styles.tokenList}>
                {list.map((token) => {
                  const isActive = selected?.name === token.name;
                  return (
                    <li key={token.name}>
                      <button
                        type="button"
                        className={`${styles.token} ${isActive ? styles.tokenActive : ''}`}
                        onClick={() => setSelected(isActive ? null : token)}
                        aria-pressed={isActive}
                      >
                        {token.group === 'color' ? (
                          <span className={styles.chip} style={{ background: token.value }} aria-hidden="true" />
                        ) : (
                          <span className={styles.chipText} aria-hidden="true">
                            {token.group === 'font' ? 'Aa' : token.value}
                          </span>
                        )}
                        <span className={styles.tokenName}>{token.name}</span>
                        <span className={styles.tokenValue}>{token.value}</span>
                        {token.origin !== 'generated' && (
                          <span className={`${styles.originTag} ${styles[token.origin]}`}>
                            {token.origin}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className={styles.group}>
            <h3 className={styles.groupTitle}>Component Bindings</h3>
            <p className={styles.groupNote}>
              How each generated component consumes the system.
            </p>
            <div className={styles.componentGrid}>
              {componentMap.map((c) => (
                <div key={c.component} className={styles.componentCard}>
                  <p className={styles.componentName}>{c.component}</p>
                  <dl className={styles.bindings}>
                    {c.bindings.map((b) => (
                      <div key={b.property} className={styles.binding}>
                        <dt>{b.property}</dt>
                        <dd>
                          <span className={styles.bindingToken}>{b.token}</span>
                          <span className={styles.bindingValue}>{b.value}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className={styles.inspector} aria-live="polite">
          {selected ? (
            <TokenInspector token={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className={styles.inspectorEmpty}>
              <p className={styles.inspectorEmptyTitle}>Token inspector</p>
              <p className={styles.inspectorEmptyBody}>
                Select a token to see its role, where it came from, what uses it, and copy it in
                three formats.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
