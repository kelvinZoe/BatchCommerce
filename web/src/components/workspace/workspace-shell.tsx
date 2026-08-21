import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/features/auth/server/actions";
import type { WorkspaceContext } from "@/lib/auth/types";
import { LogoutButton } from "./logout-button";
import styles from "./workspace-shell.module.css";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "BC";
}

export function WorkspaceShell({ context, children }: Readonly<{ context: WorkspaceContext; children: ReactNode }>) {
  return <div className={styles.shell}>
    <header className={styles.header}>
      <Link href="/dashboard" className={styles.brand} aria-label="BatchCommerce dashboard">
        <span className={styles.brandMark}>BC</span>
        <span><strong>BatchCommerce</strong><small>{context.shop.name}</small></span>
      </Link>
      <div className={styles.account}>
        <span className={styles.avatar} aria-hidden="true">{initials(context.user.fullName)}</span>
        <span className={styles.accountCopy}><strong>{context.user.fullName}</strong><small>{context.membership.roleName}</small></span>
        <form action={signOutAction}>
          <LogoutButton />
        </form>
      </div>
    </header>
    <div className={styles.body}>
      <aside className={styles.sidebar} aria-label="Workspace navigation">
        <p>Workspace</p>
        <nav><Link href="/dashboard" aria-current="page">Dashboard</Link></nav>
        <div className={styles.migrationNote}><span>Migration preview</span><p>Features appear here after their parity checks pass.</p></div>
      </aside>
      <div className={styles.content}>{children}</div>
    </div>
  </div>;
}
