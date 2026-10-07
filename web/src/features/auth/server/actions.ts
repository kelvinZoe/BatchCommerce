"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  ACTIVE_SHOP_COOKIE,
  resolveWorkspaceForUser
} from "@/lib/auth/session";
import type { AuthActionState } from "@/lib/auth/types";
import { getClientIp } from "@/lib/security/client-ip";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { loginSchema, updatePasswordSchema } from "../schemas/auth";
import { resolveSignInIdentity } from "./identifier";

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message || "Check your sign-in details.",
      fields: { identifier: String(formData.get("identifier") || "") }
    };
  }

  const requestHeaders = await headers();
  const clientKey = getClientIp(requestHeaders);
  let rateLimit;
  try {
    rateLimit = await checkRateLimit("sign-in", clientKey, {
      limit: 10,
      windowMs: 15 * 60 * 1_000
    });
  } catch (error) {
    console.error("Sign-in rate-limit check failed", {
      error: error instanceof Error ? error.message : "Unknown rate-limit error"
    });
    return {
      status: "error",
      message: "Sign-in is temporarily unavailable. Please try again.",
      fields: { identifier: parsed.data.identifier }
    };
  }
  if (!rateLimit.allowed) {
    return {
      status: "error",
      message: "Too many sign-in attempts. Please wait and try again.",
      fields: { identifier: parsed.data.identifier }
    };
  }

  const supabase = await createServerSupabaseClient();
  let identity;
  try {
    identity = await resolveSignInIdentity(parsed.data.identifier, createAdminSupabaseClient());
  } catch {
    return {
      status: "error",
      message: "We could not complete sign-in. Please try again.",
      fields: { identifier: parsed.data.identifier }
    };
  }

  if (!identity) {
    return {
      status: "error",
      message: "Invalid email, username, phone, or password.",
      fields: { identifier: parsed.data.identifier }
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    ...identity,
    password: parsed.data.password
  });

  if (error || !data.user) {
    const unconfirmed = error?.message.toLowerCase().includes("not confirmed");
    return {
      status: "error",
      message: unconfirmed
        ? "Verify your email from the confirmation message before signing in."
        : "Invalid email, username, phone, or password.",
      fields: { identifier: parsed.data.identifier }
    };
  }

  const context = await resolveWorkspaceForUser(supabase, data.user);
  if (!context) {
    const membershipResult = await supabase
      .from("shop_memberships")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .limit(1);

    if (membershipResult.data?.length) {
      await supabase.auth.signOut({ scope: "local" });
      return {
        status: "error",
        message: "Your workspace access is inactive. Contact your shop administrator.",
        fields: { identifier: parsed.data.identifier }
      };
    }

    redirect("/setup");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SHOP_COOKIE, context.shop.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

export async function updatePasswordAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message || "Check your new password."
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return {
      status: "error",
      message: "This password reset link is invalid or has expired. Request a new link."
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { status: "error", message: error.message || "Could not update your password." };
  }

  await supabase.auth.signOut({ scope: "local" });
  return {
    status: "success",
    message: "Your password has been updated. You can now sign in."
  };
}
