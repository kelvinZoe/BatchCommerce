import type { Metadata } from "next";
import { AuthCallbackClient } from "@/features/auth/components/auth-callback-client";
import { AuthShell } from "@/features/auth/components/auth-shell";

export const metadata: Metadata = { title: "Completing authentication" };

export default function AuthCallbackPage() {
  return (
    <AuthShell>
      <AuthCallbackClient />
    </AuthShell>
  );
}
