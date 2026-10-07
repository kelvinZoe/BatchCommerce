import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./auth.module.css";

export function AuthShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className={styles.loginPage}>
      <section className={styles.brandStory} aria-labelledby="brand-story-title">
        <div className={styles.brandWash} aria-hidden="true" />
        <div className={styles.brandCopy}>
          <p className={styles.brandEyebrow}>Your shop, in one clear view</p>
          <h2 id="brand-story-title">From first order<br />to final delivery.</h2>
          <p className={styles.brandSummary}>
            Keep products, batches, payments and fulfilment moving together—without losing the human rhythm of your business.
          </p>
          <div className={styles.workflow} aria-label="BatchCommerce workflow">
            <span>Order</span><i aria-hidden="true">→</i><span>Batch</span><i aria-hidden="true">→</i><span>Deliver</span>
          </div>
        </div>
        <div className={styles.brandArt} aria-hidden="true">
          <Image src="/assets/1.png" alt="" fill priority sizes="(max-width: 760px) 0px, 42vw" />
        </div>
        <p className={styles.brandNote}>Built for social sellers, preorder shops and growing teams.</p>
      </section>

      <section className={styles.authPanel} aria-label="Account access">
        {children}
        <footer className={styles.authMeta}>
          <span>© {new Date().getFullYear()} BatchCommerce</span>
          <span className={styles.metaDot} aria-hidden="true" />
          <span>Secure shop operations</span>
        </footer>
      </section>
    </main>
  );
}
