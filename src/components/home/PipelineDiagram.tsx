import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import styles from './PipelineDiagram.module.css';

/*
  The engine's pipeline, drawn.

  Every node here is a real stage of `generateDesignSystem`, in the order it actually runs:
  the inputs go into a BM25 search over products.json, that resolves a category, and the
  category drives four more searches whose winning rows become the system. Nothing on this
  diagram is invented for the picture — if the engine's stages change, this is wrong and
  should be updated.

  That distinction is what makes the motion legitimate. Markers travelling the paths are an
  ILLUSTRATION of how a system is built, on a page describing the product. They are not a
  progress meter, they do not run during generation, and they never claim that work is
  happening right now. Generation itself is synchronous and takes microseconds — the honest
  presentation of that is no animation at all, which is why the old fake step sequence was
  removed rather than restyled.
*/

interface Node {
  id: string;
  label: string;
  y: number;
}

const INPUTS: Node[] = [
  { id: 'product', label: 'PRODUCT TYPE', y: 46 },
  { id: 'industry', label: 'INDUSTRY', y: 106 },
  { id: 'keywords', label: 'KEYWORDS', y: 166 },
  { id: 'region', label: 'REGION', y: 226 },
];

const OUTPUTS: Node[] = [
  { id: 'palette', label: 'PALETTE', y: 40 },
  { id: 'type', label: 'TYPOGRAPHY', y: 100 },
  { id: 'tokens', label: 'TOKENS', y: 160 },
  { id: 'components', label: 'COMPONENTS', y: 220 },
  { id: 'reasoning', label: 'REASONING', y: 280 },
];

const HUB_X = 500;
const HUB_Y = 166;

/** Curve from a left node's right edge into the hub. */
function inPath(y: number): string {
  return `M 214 ${y} C 320 ${y}, 360 ${HUB_Y}, 436 ${HUB_Y}`;
}

/** Curve from the hub out to a right node's left edge. */
function outPath(y: number): string {
  return `M 564 ${HUB_Y} C 640 ${HUB_Y}, 680 ${y}, 774 ${y}`;
}

/*
  Marker timings.

  Staggered by hand rather than generated so the flow never pulses in unison — evenly spaced
  markers read as a machine ticking, which is the opposite of the calm this page is after.
  Durations differ per lane for the same reason.
*/
const IN_MARKERS = [
  { lane: 0, dur: 7.5, delay: 0 },
  { lane: 1, dur: 8.4, delay: 2.1 },
  { lane: 2, dur: 6.9, delay: 4.3 },
  { lane: 3, dur: 8.1, delay: 1.2 },
  { lane: 1, dur: 7.2, delay: 5.6 },
];

const OUT_MARKERS = [
  { lane: 0, dur: 7.8, delay: 1.5 },
  { lane: 2, dur: 7.1, delay: 3.4 },
  { lane: 4, dur: 8.6, delay: 0.6 },
  { lane: 3, dur: 7.4, delay: 5.2 },
];

export function PipelineDiagram() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className={styles.wrap}>
      <p className={styles.caption}>How a system is built</p>

      <div className={styles.frame}>
        {/* Soft field behind the hub. Decorative, and low enough in opacity that it cannot
            affect the contrast of anything drawn on top of it. */}
        <span className={styles.glow} aria-hidden="true" />

        <svg
          className={styles.svg}
          viewBox="0 0 1000 320"
          fill="none"
          role="img"
          aria-label="Inputs — product type, industry, keywords and region — feed a matching step, which produces a palette, typography, tokens, components and reasoning."
        >
          {/* Connectors first, so nodes paint over their ends. */}
          <g className={styles.lines}>
            {INPUTS.map((n) => (
              <path key={n.id} d={inPath(n.y)} />
            ))}
            {OUTPUTS.map((n) => (
              <path key={n.id} d={outPath(n.y)} />
            ))}
          </g>

          {/*
            Travelling markers.

            offset-path moves them along the exact same curve the connector uses, as a
            compositor transform rather than by animating x/y attributes — which would be a
            layout operation on every frame. Hidden entirely under reduced motion: frozen
            markers scattered mid-path would read as an unexplained rash of dots.
          */}
          {!reducedMotion && (
            <g aria-hidden="true">
              {IN_MARKERS.map((m, i) => (
                <circle
                  key={`in-${i}`}
                  className={`${styles.marker} ${styles.markerRaw}`}
                  r="4"
                  style={{
                    offsetPath: `path("${inPath(INPUTS[m.lane].y)}")`,
                    animationDuration: `${m.dur}s`,
                    animationDelay: `-${m.delay}s`,
                  }}
                />
              ))}
              {OUT_MARKERS.map((m, i) => (
                <circle
                  key={`out-${i}`}
                  className={`${styles.marker} ${styles.markerDone}`}
                  r="4"
                  style={{
                    offsetPath: `path("${outPath(OUTPUTS[m.lane].y)}")`,
                    animationDuration: `${m.dur}s`,
                    animationDelay: `-${m.delay}s`,
                  }}
                />
              ))}
            </g>
          )}

          {/* Input nodes */}
          {INPUTS.map((n) => (
            <g key={n.id} className={styles.node}>
              <rect x="16" y={n.y - 17} width="198" height="34" rx="17" />
              <text x="40" y={n.y + 5}>
                {n.label}
              </text>
            </g>
          ))}

          {/* The hub. The dotted ring echoes the mark in the nav rather than being a spinner —
              it does not rotate, because nothing is spinning. */}
          <g className={styles.hub}>
            <rect x="436" y={HUB_Y - 44} width="128" height="88" rx="28" />
            <text x={HUB_X} y={HUB_Y - 12} textAnchor="middle" className={styles.hubLabel}>
              MATCH
            </text>
            <text x={HUB_X} y={HUB_Y + 22} textAnchor="middle" className={styles.hubSub}>
              BM25
            </text>
          </g>

          {/* Output nodes */}
          {OUTPUTS.map((n) => (
            <g key={n.id} className={`${styles.node} ${styles.nodeOut}`}>
              <rect x="774" y={n.y - 17} width="210" height="34" rx="17" />
              <text x="798" y={n.y + 5}>
                {n.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
