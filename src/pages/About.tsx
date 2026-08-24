import { Link } from 'react-router-dom';
import styles from './About.module.css';

/**
 * Copy is kept in sync with ABOUT.md by hand, not imported from it.
 *
 * ABOUT.md is a repo document: it opens with an H1, carries build notes and a status section,
 * and is written for someone deciding whether to read the source. Rendering it here would put
 * all of that in front of a visitor who only wants to know what the tool does. The overlap is
 * a few sentences, so duplicating them costs less than a transform that would have to strip
 * most of the file.
 */
export default function AboutPage() {
  return (
    <div className={`container ${styles.wrap}`}>
      <h2 className={styles.title}>About</h2>

      <p className={styles.lede}>
        Basis generates a design system from one sentence, and tells you why it chose what it
        chose.
      </p>

      <p className={styles.body}>
        Describe what you are building — a fintech app for first-time users in Nigeria, a dark
        analytics dashboard, a minimal portfolio — and Basis returns a complete starting point:
        a colour palette with its contrast checked, a font pairing, a layout pattern, spacing
        and radius tokens, component specifications, and a live preview rendered in the system
        it just built.
      </p>

      <p className={styles.body}>
        Every major decision comes with the reasoning behind it, drawn from the data that
        produced it rather than written after the fact. Where a value was derived from another,
        or filled in from a default because the dataset had nothing to say, Basis labels it as
        such instead of presenting it as a considered choice.
      </p>

      <p className={styles.body}>
        It runs entirely in your browser. Generating, exploring and exporting a system need no
        account and send nothing anywhere. An optional account exists only so saved systems
        follow you between devices.
      </p>

      <p className={styles.body}>
        <Link to="/generator" className={styles.link}>
          Generate a system
        </Link>{' '}
        to see what it produces.
      </p>
    </div>
  );
}
