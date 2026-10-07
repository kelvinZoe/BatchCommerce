"use client";

import { useEffect } from "react";
import styles from "./status.module.css";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.page}>
      <p className={styles.code}>Something went wrong</p>
      <h1>BatchCommerce couldn’t load this view.</h1>
      <button className={styles.action} type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
