import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import styles from "@/features/auth/components/auth.module.css";

export const metadata: Metadata = { title: "Create your shop" };

export default function SetupPage() {
  return (
    <AuthShell>
      <div className={styles.authCard}>
        <header className={styles.authHeader}>
          <p className={styles.eyebrow}>Workspace setup</p>
          <h1>Create your shop</h1>
          <p>
            Your account is verified. Workspace creation is the next migration slice;
            the existing Angular setup remains the production flow until then.
          </p>
        </header>
        <Link className={styles.primaryLink} href="/login">Return to sign in</Link>
      </div>
    </AuthShell>
  );
}
