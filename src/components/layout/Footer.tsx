import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.inner} container`}>
        <span className={styles.brand}>Basis</span>
        <p className={styles.note}>
          Every palette, pairing, and pattern comes from matched design data and rules — not a
          model improvising. Free to use, no account required.
        </p>
      </div>
    </footer>
  );
}
