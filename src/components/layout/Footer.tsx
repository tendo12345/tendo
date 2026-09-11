import { BasisLogo } from '../brand/BasisLogo';
import { accountsEnabled } from '../../lib/supabase';
import styles from './Footer.module.css';

export function Footer() {
  /*
    The access line depends on the deployment, because the truth does.

    It used to say "no account required" everywhere. That stopped being true when the
    generator went behind sign-in, and stayed on the page for every visitor. Where a Supabase
    project is configured, generating needs an account; where none is, Basis runs with no
    backend and genuinely needs none — RequireAccount lets everyone through. One fixed
    sentence is false in one of those two, so this reads the same switch the gate reads.

    The wording matches the hero's note, so a signed-out visitor meets one claim, not two.
  */
  const access = accountsEnabled()
    ? 'Free to use — generating needs an account, one email and no password.'
    : 'Free to use, no account required.';

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
          model improvising. {access}
        </p>
      </div>
    </footer>
  );
}
