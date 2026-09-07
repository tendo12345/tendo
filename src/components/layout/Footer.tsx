import { BasisLogo } from '../brand/BasisLogo';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.inner} container`}>
        {/*
          Full lockup here, at every width. The footer is a brand area with one short line
          beside it and nothing competing for the row, so the wordmark costs nothing — which is
          exactly the case §24 has in mind when it says not to drop it just because a
          breakpoint was crossed. No `responsive`, and no `entrance`: this sits below the fold,
          so an entrance would either have already finished unseen or need a scroll trigger the
          brief asks the logo not to have.
        */}
        <BasisLogo href="/" variant="full" size="md" className={styles.brand} />
        <p className={styles.note}>
          Every palette, pairing, and pattern comes from matched design data and rules — not a
          model improvising. Free to use, no account required.
        </p>
      </div>
    </footer>
  );
}
