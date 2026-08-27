import { useMediaQuery } from '../../hooks/useMediaQuery';
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

  TWO LAYOUTS, and the narrow one is not optional.

  This began as one wide diagram that scrolled sideways inside its frame on small screens.
  That looked defensible in the CSS and was wrong on a phone: what fits is the inputs and the
  hub, with every output off-screen. The entire meaning of the diagram is inputs → match →
  outputs, so hiding the outputs behind a horizontal scroll leaves the half that explains
  nothing. A diagram whose point requires scrolling to see is not a diagram.

  So narrow screens get a genuine vertical flow: inputs above, hub, outputs below. It is a
  second geometry to keep in step, which is a real cost — but the alternative was shipping a
  picture that only works on a laptop.
*/

interface Node {
  id: string;
  label: string;
}

const INPUTS: Node[] = [
  { id: 'product', label: 'PRODUCT TYPE' },
  { id: 'industry', label: 'INDUSTRY' },
  { id: 'keywords', label: 'KEYWORDS' },
  { id: 'region', label: 'REGION' },
];

const OUTPUTS: Node[] = [
  { id: 'palette', label: 'PALETTE' },
  { id: 'type', label: 'TYPOGRAPHY' },
  { id: 'tokens', label: 'TOKENS' },
  { id: 'components', label: 'COMPONENTS' },
  { id: 'reasoning', label: 'REASONING' },
];

const DESCRIPTION =
  'Inputs — product type, industry, keywords and region — feed a matching step, which produces a palette, typography, tokens, components and reasoning.';

/* ---------------------------------------------------------------- wide ---- */

const WIDE = {
  viewBox: '0 0 1000 320',
  hubX: 500,
  hubY: 166,
  inputY: (i: number) => 46 + i * 60,
  outputY: (i: number) => 40 + i * 60,
};

const widePathIn = (i: number) =>
  `M 214 ${WIDE.inputY(i)} C 320 ${WIDE.inputY(i)}, 360 ${WIDE.hubY}, 436 ${WIDE.hubY}`;

const widePathOut = (i: number) =>
  `M 564 ${WIDE.hubY} C 640 ${WIDE.hubY}, 680 ${WIDE.outputY(i)}, 774 ${WIDE.outputY(i)}`;

/* -------------------------------------------------------------- narrow ---- */

const NARROW = {
  viewBox: '0 0 360 640',
  hubX: 180,
  hubY: 300,
  inputX: (i: number) => (i % 2 === 0 ? 12 : 190),
  inputY: (i: number) => 34 + Math.floor(i / 2) * 56,
  outputY: (i: number) => 420 + i * 44,
};

/** Inputs sit in a 2×2 block and converge downward into the hub. */
const narrowPathIn = (i: number) =>
  `M ${NARROW.inputX(i) + 79} ${NARROW.inputY(i) + 17} C ${NARROW.inputX(i) + 79} ${
    NARROW.inputY(i) + 70
  }, ${NARROW.hubX} ${NARROW.hubY - 90}, ${NARROW.hubX} ${NARROW.hubY - 44}`;

/** Outputs stack below and fan out from the hub. */
const narrowPathOut = (i: number) =>
  `M ${NARROW.hubX} ${NARROW.hubY + 44} C ${NARROW.hubX} ${NARROW.hubY + 90}, ${
    NARROW.hubX
  } ${NARROW.outputY(i) - 30}, ${NARROW.hubX} ${NARROW.outputY(i) - 17}`;

/*
  Marker timings. Staggered by hand rather than generated so the flow never pulses in unison —
  evenly spaced markers read as a machine ticking, which is the opposite of the calm this page
  is after. Durations differ per lane for the same reason.
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
  const narrow = useMediaQuery('(max-width: 640px)');

  const pathIn = narrow ? narrowPathIn : widePathIn;
  const pathOut = narrow ? narrowPathOut : widePathOut;
  const geo = narrow ? NARROW : WIDE;

  return (
    <div className={styles.wrap}>
      <p className={styles.caption}>How a system is built</p>

      <div className={styles.frame}>
        {/* Soft field behind the hub. Decorative, and low enough in opacity that it cannot
            affect the contrast of anything drawn on top of it. */}
        <span
          className={`${styles.glow} ${narrow ? styles.glowNarrow : ''}`}
          aria-hidden="true"
        />

        <svg
          className={styles.svg}
          viewBox={geo.viewBox}
          fill="none"
          role="img"
          aria-label={DESCRIPTION}
        >
          <g className={styles.lines}>
            {INPUTS.map((n, i) => (
              <path key={n.id} d={pathIn(i)} />
            ))}
            {OUTPUTS.map((n, i) => (
              <path key={n.id} d={pathOut(i)} />
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
                    offsetPath: `path("${pathIn(m.lane)}")`,
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
                    offsetPath: `path("${pathOut(m.lane)}")`,
                    animationDuration: `${m.dur}s`,
                    animationDelay: `-${m.delay}s`,
                  }}
                />
              ))}
            </g>
          )}

          {/* Input nodes */}
          {INPUTS.map((n, i) => (
            <g key={n.id} className={styles.node}>
              {narrow ? (
                <>
                  <rect x={NARROW.inputX(i)} y={NARROW.inputY(i)} width="158" height="34" rx="17" />
                  <text x={NARROW.inputX(i) + 16} y={NARROW.inputY(i) + 22}>
                    {n.label}
                  </text>
                </>
              ) : (
                <>
                  <rect x="16" y={WIDE.inputY(i) - 17} width="198" height="34" rx="17" />
                  <text x="40" y={WIDE.inputY(i) + 5}>
                    {n.label}
                  </text>
                </>
              )}
            </g>
          ))}

          {/* The hub. The dotted ring echoes the mark in the nav rather than being a spinner —
              it does not rotate, because nothing is spinning. */}
          <g className={styles.hub}>
            <rect x={geo.hubX - 64} y={geo.hubY - 44} width="128" height="88" rx="28" />
            <text x={geo.hubX} y={geo.hubY - 12} textAnchor="middle" className={styles.hubLabel}>
              MATCH
            </text>
            <text x={geo.hubX} y={geo.hubY + 22} textAnchor="middle" className={styles.hubSub}>
              BM25
            </text>
          </g>

          {/* Output nodes */}
          {OUTPUTS.map((n, i) => (
            <g key={n.id} className={`${styles.node} ${styles.nodeOut}`}>
              {narrow ? (
                <>
                  <rect x="101" y={NARROW.outputY(i) - 17} width="158" height="34" rx="17" />
                  <text x={NARROW.hubX} y={NARROW.outputY(i) + 5} textAnchor="middle">
                    {n.label}
                  </text>
                </>
              ) : (
                <>
                  <rect x="774" y={WIDE.outputY(i) - 17} width="210" height="34" rx="17" />
                  <text x="798" y={WIDE.outputY(i) + 5}>
                    {n.label}
                  </text>
                </>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
