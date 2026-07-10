import styles from '../styles/Loader.module.css';

export default function Loader() {
  return (
    <div className={styles.status} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span>
        <strong className={styles.title}>Preparing page</strong>
        <span className={styles.description}>Loading content and restoring highlights…</span>
      </span>
    </div>
  );
}
