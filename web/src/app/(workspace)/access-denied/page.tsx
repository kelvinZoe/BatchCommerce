import Link from "next/link";
import type { Metadata } from "next";
import { hasPermission } from "@/lib/auth/permissions";
import { requireWorkspace } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Access denied" };

export default async function AccessDeniedPage() {
  const context = await requireWorkspace();
  const canOpenDashboard = hasPermission(context, "dashboard");
  return <main>
    <p>Permission required</p>
    <h1>You don’t have access to that area.</h1>
    <p>Your {context.membership.roleName} role does not include this permission. Ask a shop administrator if you believe this is a mistake.</p>
    {canOpenDashboard ? <Link href="/dashboard">Return to dashboard</Link> : null}
  </main>;
}
