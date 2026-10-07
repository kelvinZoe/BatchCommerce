"use client";

import { useFormStatus } from "react-dom";
import { LogoutIcon } from "@/features/auth/components/icons";
import styles from "./workspace-shell.module.css";

export function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <button className={styles.logout} type="submit" disabled={pending} aria-busy={pending}>
      <LogoutIcon />
      <span>{pending ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
