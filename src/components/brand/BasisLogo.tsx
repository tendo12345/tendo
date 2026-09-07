import { Link } from 'react-router-dom';
import { MARK_INTRINSIC, MARK_SRC, WORD_INTRINSIC, WORD_LIGHT_SRC, WORD_SRC } from './assets';
import styles from './BasisLogo.module.css';

export type LogoVariant = 'full' | 'mark' | 'wordmark';
export type LogoSize = 'sm' | 'md' | 'lg';
export type LogoTheme = 'default' | 'light' | 'dark';

interface BasisLogoProps {
  /** `full` = mark + wordmark, `mark` = the block cluster alone, `wordmark` = the word alone. */
  variant?: LogoVariant;
  /** Mark height: sm 28px, md 32px, lg 40px. The wordmark is derived from it, never set. */
  size?: LogoSize;
  /**
   * Which wordmark to use. `default` follows the viewer's colour scheme, which is right
   * everywhere in this app because every surface it sits on follows the same scheme. `light`
   * and `dark` force one, for a panel whose colour does NOT track the theme.
   */
  theme?: LogoTheme;
  /** Renders a link when given. Omit for a logo that is decoration rather than navigation. */
  href?: string;
  /** Play the entrance once on mount. Off by default; the bar opts in. */
  entrance?: boolean;
  /**
   * Drop the wordmark below 768px, keeping the mark.
   *
   * Done in CSS rather than by switching `variant` from a media-query hook, because
   * useMediaQuery's own docblock says so: a layout difference CSS can express belongs in CSS,
   * or the breakpoint ends up written in two places that disagree. It also means the correct
   * logo is in the first paint rather than after an effect resolves.
   *
   * Only meaningful with variant="full".
   */
  responsive?: boolean;
  className?: string;
}

/*
  Size is a CLASS, not an inline custom property, and that distinction is load-bearing.

  `style={{ '--logo-h': '32px' }}` shipped first and looked right everywhere except the one
  place it mattered: an inline custom property beats a stylesheet rule at any specificity, so
  the `@media (max-width: 767px)` step-down to 28px never applied and the bar kept a 32px mark
  on phones. Nothing errored — the wordmark still hid, because that rule targets a descendant
  — so the only symptom was a number quietly disagreeing with the comment describing it.

  As a class it lives in the same cascade as the media query, which is later in the file and
  therefore wins.
*/
const SIZE_CLASS: Record<LogoSize, string> = { sm: styles.sm, md: styles.md, lg: styles.lg };

/**
 * The Basis logo. One implementation, three variants, used everywhere the brand appears.
 *
 * The art is the supplied render, cut from brand/basis-logo-master.png by
 * scripts/build-brand.py. It is raster and stays raster: the mark is a shaded 3D cluster with
 * soft bevels and per-face gradients, and there is no honest SVG of it — tracing it would
 * produce a flat approximation that is a different logo wearing the same silhouette. §16
 * asks for SVG only where the conversion preserves the appearance, and here it does not.
 *
 * `full` is composed from the two assets rather than shipped as a third image, at the exact
 * proportions measured off the master: the wordmark is 0.5612 of the mark's height, set
 * 0.1339 of that height away from it, and its optical centre sits 0.030 of that height above
 * the mark's. Composing means the lockup, the mark alone and the responsive bar all draw the
 * same two files, and a size change is one number rather than a re-export.
 */
export function BasisLogo({
  variant = 'full',
  size = 'md',
  theme = 'default',
  href,
  entrance = false,
  responsive = false,
  className,
}: BasisLogoProps) {
  const classes = [
    styles.logo,
    SIZE_CLASS[size],
    entrance ? styles.entrance : '',
    responsive ? styles.responsive : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  /*
    The wordmark is alt="" whenever the logo is a link, because the link is already named
    "Basis home" and a second name inside it is read out twice. Standalone, the word carries
    the name itself. The mark is always alt="" — it is never the only thing conveying the
    brand in a place where the word is absent and unlabelled.
  */
  const wordAlt = href ? '' : 'Basis';

  const mark =
    variant !== 'wordmark' ? (
      <img
        className={styles.mark}
        src={MARK_SRC}
        alt=""
        width={MARK_INTRINSIC.width}
        height={MARK_INTRINSIC.height}
        decoding="async"
      />
    ) : null;

  /*
    Dark mode swaps the wordmark file, and <picture> is what does it.

    The alternative — both images in the DOM, one hidden by a media query — downloads two
    files to show one, on every page. A <source media> is resolved before the fetch, so
    exactly one is requested. Forcing `light` or `dark` drops the source element entirely
    rather than trying to out-specify it.
  */
  const word =
    variant !== 'mark' ? (
      <picture className={styles.wordPic}>
        {theme === 'default' && (
          <source srcSet={WORD_LIGHT_SRC} media="(prefers-color-scheme: dark)" />
        )}
        <img
          className={styles.word}
          src={theme === 'light' ? WORD_LIGHT_SRC : WORD_SRC}
          alt={wordAlt}
          width={WORD_INTRINSIC.width}
          height={WORD_INTRINSIC.height}
          decoding="async"
        />
      </picture>
    ) : null;

  if (!href) {
    return (
      <span className={classes}>
        {mark}
        {word}
      </span>
    );
  }

  /*
    "Basis home", not "Basis".

    The visible word is "Basis", and WCAG 2.5.3 requires the accessible name to contain the
    visible label — "Basis home" does, so "click Basis" still works by voice. Naming it
    "Home" alone would break that match. This repo has shipped a 2.5.3 failure once already,
    from an aria-label that replaced a visible label instead of extending it.
  */
  return (
    <Link to={href} className={classes} aria-label="Basis home">
      {mark}
      {word}
    </Link>
  );
}
