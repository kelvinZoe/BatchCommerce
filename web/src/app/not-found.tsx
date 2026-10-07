import Link from "next/link";
import styles from "./status.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <p className={styles.code}>404</p>
      <h1>We couldn’t find that page.</h1>
      <Link href="/">Return to BatchCommerce</Link>
    </main>
  );
}
