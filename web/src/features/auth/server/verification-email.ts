import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { escapeHtml, getEmailBranding, sendResendEmail } from "./email";

export async function createSignupVerification(input: {
  email: string;
  fullName: string;
  phone: string;
  password: string;
}) {
  const { appBaseUrl } = getEmailBranding();
  const callbackUrl = new URL("/auth/callback", `${appBaseUrl}/`);
  callbackUrl.searchParams.set("next", "/setup");

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: input.email,
    password: input.password,
    options: {
      redirectTo: callbackUrl.toString(),
      data: {
        full_name: input.fullName,
        phone: input.phone
      }
    }
  });

  if (error || !data.user?.id || !data.properties?.action_link) {
    throw new Error(error?.message || "Could not generate an email verification link.");
  }

  const phoneUpdate = await admin.auth.admin.updateUserById(data.user.id, {
    phone: input.phone,
    phone_confirm: false,
    user_metadata: {
      full_name: input.fullName,
      phone: input.phone
    }
  });

  if (phoneUpdate.error) {
    await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    throw phoneUpdate.error;
  }

  return {
    authUserId: data.user.id,
    verificationLink: data.properties.action_link
  };
}

export async function rollbackSignupVerification(authUserId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const existing = await admin.auth.admin.getUserById(authUserId);
  if (existing.error) throw existing.error;
  if (!existing.data.user || existing.data.user.email_confirmed_at) return false;

  const deletion = await admin.auth.admin.deleteUser(authUserId);
  if (deletion.error) throw deletion.error;
  return true;
}

export async function sendVerificationEmail(input: {
  email: string;
  fullName: string;
  verificationLink: string;
  idempotencyKey: string;
}) {
  const { logoUrl } = getEmailBranding();
  const safeName = escapeHtml(input.fullName || "there");
  const safeLink = escapeHtml(input.verificationLink);
  const safeLogoUrl = escapeHtml(logoUrl);
  const text = [
    `Hello ${input.fullName || "there"},`,
    "",
    "Your BatchCommerce account was created successfully.",
    "Confirm your email address to finish setting up your shop.",
    "",
    `Verify your email: ${input.verificationLink}`,
    "",
    "If you did not request this account, you can safely ignore this email."
  ].join("\n");
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#102d2a;background:#fbf8ef;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dce7e2;border-radius:14px;padding:28px">
        <img src="${safeLogoUrl}" width="280" alt="BatchCommerce" style="display:block;width:280px;max-width:100%;height:auto;margin:0 0 22px;border:0;border-radius:10px">
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#158f82">BatchCommerce Support</p>
        <h2 style="margin:0 0 14px;font-size:25px;line-height:1.3;color:#102d2a">Verify your email</h2>
        <p style="margin:0 0 14px">Hello ${safeName},</p>
        <p style="margin:0 0 14px">Your account is ready. Confirm your email address to finish setting up your shop.</p>
        <p style="margin:22px 0"><a href="${safeLink}" style="display:inline-block;padding:12px 18px;background:#102d2a;color:#fff;text-decoration:none;border-radius:9px;font-weight:600">Verify email</a></p>
        <p style="margin:0 0 10px;font-size:13px;color:#47635f">If the button does not work, copy and paste this link:</p>
        <p style="margin:0 0 18px;word-break:break-all;font-size:13px"><a href="${safeLink}" style="color:#0b685f">${safeLink}</a></p>
        <p style="margin:0;color:#47635f">If you did not request this account, you can safely ignore this email.</p>
      </div>
    </div>`;

  return sendResendEmail({
    to: input.email,
    subject: "Verify your BatchCommerce account",
    text,
    html,
    idempotencyKey: input.idempotencyKey
  });
}
