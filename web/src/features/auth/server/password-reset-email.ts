import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnvironment } from "@/lib/env/server";

export const SYSTEM_EMAIL_FROM = "BatchCommerce Support <support@pharma-uci.com>";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendPasswordResetEmail(email: string, requestOrigin: string) {
  const environment = getServerEnvironment();
  if (!environment.RESEND_API_KEY) throw new Error("Resend is not configured.");

  const appBaseUrl = (environment.APP_BASE_URL || requestOrigin).replace(/\/$/, "");
  const redirectTo = `${appBaseUrl}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo }
  });

  if (error || !data.properties?.action_link) {
    throw new Error(error?.message || "Could not generate a password reset link.");
  }

  const link = data.properties.action_link;
  const logoUrl = environment.EMAIL_LOGO_URL || `${appBaseUrl}/assets/BatchCommerce.png`;
  const safeLink = escapeHtml(link);
  const safeLogoUrl = escapeHtml(logoUrl);
  const text = [
    "We received a request to reset your BatchCommerce password.",
    "",
    `Reset your password: ${link}`,
    "",
    "If you did not request this, you can safely ignore this email."
  ].join("\n");
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#102d2a;background:#fbf8ef;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dce7e2;border-radius:14px;padding:28px">
        <img src="${safeLogoUrl}" width="280" alt="BatchCommerce" style="display:block;width:280px;max-width:100%;height:auto;margin:0 0 22px;border:0;border-radius:10px">
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#158f82">BatchCommerce Support</p>
        <h2 style="margin:0 0 14px;font-size:25px;line-height:1.3;color:#102d2a">Reset your password</h2>
        <p style="margin:0 0 14px">We received a request to reset your BatchCommerce password.</p>
        <p style="margin:22px 0"><a href="${safeLink}" style="display:inline-block;padding:12px 18px;background:#102d2a;color:#fff;text-decoration:none;border-radius:9px;font-weight:600">Reset password</a></p>
        <p style="margin:0 0 10px;font-size:13px;color:#47635f">If the button does not work, copy and paste this link:</p>
        <p style="margin:0 0 18px;word-break:break-all;font-size:13px"><a href="${safeLink}" style="color:#0b685f">${safeLink}</a></p>
        <p style="margin:0;color:#47635f">If you did not request this, you can safely ignore this email.</p>
      </div>
    </div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${environment.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: SYSTEM_EMAIL_FROM,
      to: [email],
      subject: "Reset your BatchCommerce password",
      text,
      html
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const providerMessage = await response.text().catch(() => "");
    throw new Error(`Resend rejected password reset email (${response.status}): ${providerMessage}`);
  }

  const providerResult = (await response.json().catch(() => ({}))) as { id?: string };
  return { providerMessageId: providerResult.id || null };
}
