import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const context = await requirePermission("dashboard");
  return (
    <main>
      <p>Migration workspace</p>
      <h1>{context.shop.name}</h1>
      <p>This route now verifies your Supabase session, active shop membership, profile, role, and dashboard permission on the server.</p>
    </main>
  );
}
