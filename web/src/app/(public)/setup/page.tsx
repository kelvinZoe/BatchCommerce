import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { RegistrationForm } from "@/features/auth/components/registration-form";
import { WorkspaceSetupForm } from "@/features/auth/components/workspace-setup-form";
import { AlertIcon } from "@/features/auth/components/icons";
import { signOutAction } from "@/features/auth/server/actions";
import { getAuthenticatedUser, getWorkspaceContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "@/features/auth/components/auth.module.css";

export const metadata: Metadata = { title: "Create your shop" };

export default async function SetupPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return (
      <AuthShell>
        <RegistrationForm />
      </AuthShell>
    );
  }

  const workspace = await getWorkspaceContext();
  if (workspace) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();
  const membershipResult = await supabase
    .from("shop_memberships")
    .select("id, is_active, is_owner, membership_status")
    .eq("auth_user_id", user.id)
    .limit(1);

  if (membershipResult.error) {
    throw new Error("Could not verify your workspace setup status.");
  }

  if (membershipResult.data?.length) {
    return (
      <AuthShell>
        <div className={styles.authCard}>
          <header className={styles.authHeader}>
            <p className={styles.eyebrow}>Workspace access</p>
            <h1>Setup unavailable</h1>
            <p>This account already has a workspace membership that is not currently active.</p>
          </header>
          <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
            <AlertIcon />
            <span>Contact your shop administrator or BatchCommerce Support before creating another shop.</span>
          </div>
          <form action={signOutAction}>
            <button className={styles.secondaryActionButton} type="submit">Sign out</button>
          </form>
        </div>
      </AuthShell>
    );
  }

  const fullName = String(user.user_metadata.full_name || user.user_metadata.name || "");
  const phone = String(user.user_metadata.phone || user.phone || "");

  return (
    <AuthShell>
      <WorkspaceSetupForm
        email={user.email || "Verified account"}
        initialFullName={fullName}
        initialPhone={phone}
      />
    </AuthShell>
  );
}
