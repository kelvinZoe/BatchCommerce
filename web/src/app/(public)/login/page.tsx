import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { LoginForm } from "@/features/auth/components/login-form";
import { getAuthenticatedUser, getWorkspaceContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams
}: Readonly<{ searchParams: Promise<{ password?: string }> }>) {
  const user = await getAuthenticatedUser();
  if (user) {
    const context = await getWorkspaceContext();
    redirect(context ? "/dashboard" : "/setup");
  }

  const query = await searchParams;
  return (
    <AuthShell>
      <LoginForm
        initialNotice={
          query.password === "updated"
            ? "Your password is ready. Sign in with your new password."
            : undefined
        }
      />
    </AuthShell>
  );
}
