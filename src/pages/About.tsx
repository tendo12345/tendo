import styles from './About.module.css';

export default function AboutPage() {
  return (
    <div className={`container ${styles.wrap}`}>
      <h2 className={styles.title}>About</h2>
      <p className={styles.body}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
        incididunt ut labore et dolore magna aliqua.
      </p>
    </div>
  );
}
