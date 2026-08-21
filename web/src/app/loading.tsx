import styles from "./status.module.css";

export default function Loading() {
  return (
    <main className={styles.page} aria-live="polite" aria-busy="true">
      <span className={styles.spinner} aria-hidden="true" />
      <p>Loading BatchCommerce…</p>
    </main>
  );
}
