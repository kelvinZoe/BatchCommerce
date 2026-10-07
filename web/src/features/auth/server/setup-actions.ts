"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_SHOP_COOKIE } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security/client-ip";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/lib/auth/types";
import {
  registrationSchema,
  workspaceBootstrapResultSchema,
  workspaceSetupSchema
} from "../schemas/auth";
import { wasEmailDefinitivelyRejected } from "./email";
import {
  createSignupVerification,
  rollbackSignupVerification,
  sendVerificationEmail
} from "./verification-email";

const DEVICE_ID_COOKIE = "batchcommerce_device_id";

function actionFields(formData: FormData) {
  return {
    fullName: String(formData.get("fullName") || ""),
    email: String(formData.get("email") || ""),
    phone: String(formData.get("phone") || ""),
    shopName: String(formData.get("shopName") || "")
  };
}

async function requestContext() {
  const requestHeaders = await headers();
  return { clientKey: getClientIp(requestHeaders) };
}

function registrationErrorMessage(error: unknown): string {
  const record = error && typeof error === "object" ? error as { code?: string; message?: string } : {};
  const message = record.message?.toLowerCase() || "";
  if (record.code === "email_exists" || message.includes("email") && message.includes("exist")) {
    return "This email is already registered. Please sign in instead.";
  }
  if (record.code === "phone_exists" || message.includes("phone") && message.includes("exist")) {
    return "This phone number is already registered. Please sign in instead.";
  }
  return "We could not create your account. Please try again.";
}

export async function registerAccountAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const fields = actionFields(formData);
  const parsed = registrationSchema.safeParse({
    fullName: fields.fullName,
    email: fields.email,
    phone: fields.phone,
    password: formData.get("password")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message || "Check your account details.",
      fields
    };
  }

  const request = await requestContext();
  let limit;
  try {
    limit = await checkRateLimit("register", request.clientKey, {
      limit: 5,
      windowMs: 60 * 60 * 1_000
    });
  } catch (error) {
    console.error("Registration rate-limit check failed", {
      error: error instanceof Error ? error.message : "Unknown rate-limit error"
    });
    return {
      status: "error",
      message: "Registration is temporarily unavailable. Please try again.",
      fields
    };
  }
  if (!limit.allowed) {
    return {
      status: "error",
      message: "Too many account requests. Please wait and try again.",
      fields
    };
  }

  const requestId = crypto.randomUUID();
  let signup: Awaited<ReturnType<typeof createSignupVerification>>;
  try {
    signup = await createSignupVerification({
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone
    });
  } catch (error) {
    console.warn("Registration rejected", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown registration error"
    });
    return {
      status: "error",
      message: registrationErrorMessage(error),
      fields
    };
  }

  try {
    const delivery = await sendVerificationEmail({
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      verificationLink: signup.verificationLink,
      idempotencyKey: `verification/${requestId}`
    });
    console.info("Verification email accepted by Resend", {
      requestId,
      providerMessageId: delivery.providerMessageId
    });
  } catch (deliveryError) {
    console.error("Verification email delivery failed", {
      requestId,
      authUserId: signup.authUserId,
      error: deliveryError instanceof Error ? deliveryError.message : "Unknown delivery error"
    });
    let rolledBack = false;
    if (wasEmailDefinitivelyRejected(deliveryError)) {
      try {
        rolledBack = await rollbackSignupVerification(signup.authUserId);
      } catch (rollbackError) {
        console.error("Registration rollback failed", {
          requestId,
          authUserId: signup.authUserId,
          error: rollbackError instanceof Error ? rollbackError.message : "Unknown rollback error"
        });
      }
    }
    return {
      status: "error",
      message: rolledBack
        ? "We could not send the verification email, so no account was kept. Please try again."
        : "We could not confirm verification-email delivery. Please contact BatchCommerce Support before trying again.",
      fields
    };
  }

  return {
    status: "success",
    message: `Account created. We sent a verification email to ${parsed.data.email}. Confirm it, then finish creating your shop.`,
    fields: { email: parsed.data.email }
  };
}

export async function createWorkspaceAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const fields = actionFields(formData);
  const parsed = workspaceSetupSchema.safeParse(fields);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message || "Check your shop details.",
      fields
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (authError || !authUser) {
    return { status: "error", message: "Please sign in before creating your shop.", fields };
  }

  const email = authUser.email?.trim().toLowerCase();
  if (!email) {
    return { status: "error", message: "Your verified account does not have an email address.", fields };
  }

  const membershipResult = await supabase
    .from("shop_memberships")
    .select("id, is_owner, is_active, membership_status")
    .eq("auth_user_id", authUser.id)
    .limit(1);

  if (membershipResult.error) {
    return { status: "error", message: "We could not verify your workspace eligibility.", fields };
  }
  if (membershipResult.data?.length) {
    return {
      status: "error",
      message: "This account already has workspace access. Sign in or contact the shop administrator.",
      fields
    };
  }

  const request = await requestContext();
  let limit;
  try {
    limit = await checkRateLimit(
      "workspace-setup",
      `${authUser.id}:${request.clientKey}`,
      {
        limit: 5,
        windowMs: 60 * 60 * 1_000
      }
    );
  } catch (error) {
    console.error("Workspace-setup rate-limit check failed", {
      authUserId: authUser.id,
      error: error instanceof Error ? error.message : "Unknown rate-limit error"
    });
    return {
      status: "error",
      message: "Workspace setup is temporarily unavailable. Please try again.",
      fields
    };
  }
  if (!limit.allowed) {
    return { status: "error", message: "Too many setup attempts. Please wait and try again.", fields };
  }

  const cookieStore = await cookies();
  const deviceId = cookieStore.get(DEVICE_ID_COOKIE)?.value || crypto.randomUUID();
  const { data, error } = await supabase.rpc("bootstrap_shop_workspace", {
    p_shop_name: parsed.data.shopName,
    p_full_name: parsed.data.fullName,
    p_email: email,
    p_phone: parsed.data.phone,
    p_owner_device_id: deviceId
  });

  if (error) {
    const duplicateOwner = error.message.toLowerCase().includes("already owns");
    const duplicateDevice = error.message.toLowerCase().includes("device");
    return {
      status: "error",
      message: duplicateOwner || duplicateDevice
        ? error.message
        : "We could not create your workspace. Please try again.",
      fields
    };
  }

  const result = workspaceBootstrapResultSchema.safeParse(data);
  if (!result.success) {
    console.error("Workspace bootstrap returned an invalid contract", {
      authUserId: authUser.id,
      issues: result.error.issues.map((issue) => issue.path.join("."))
    });
    return {
      status: "error",
      message: "Your shop was created, but its workspace response was incomplete. Contact support.",
      fields
    };
  }

  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/"
  };
  cookieStore.set(DEVICE_ID_COOKIE, deviceId, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 365 * 2
  });
  cookieStore.set(ACTIVE_SHOP_COOKIE, result.data.shopId, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 365
  });

  redirect("/dashboard");
}
