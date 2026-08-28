import { Button } from '../components/ui/Button';
import styles from './NotFound.module.css';

export default function NotFoundPage() {
  return (
    <div className={`container ${styles.wrap}`}>
      <span className={styles.code}>404</span>
      <h1 className={styles.title}>This Page Doesn't Exist.</h1>
      <Button href="/" variant="primary">
        Back to home
      </Button>
    </div>
  );
}
