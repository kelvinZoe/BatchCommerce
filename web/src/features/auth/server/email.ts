import "server-only";

import { getServerEnvironment } from "@/lib/env/server";

export const SYSTEM_EMAIL_FROM = "BatchCommerce Support <support@pharma-uci.com>";

export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    readonly definitivelyRejected: boolean,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "EmailDeliveryError";
  }
}

export function wasEmailDefinitivelyRejected(error: unknown): boolean {
  return error instanceof EmailDeliveryError && error.definitivelyRejected;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function getEmailBranding() {
  const environment = getServerEnvironment();
  const appBaseUrl = environment.APP_BASE_URL.replace(/\/$/, "");

  return {
    appBaseUrl,
    logoUrl: environment.EMAIL_LOGO_URL || `${appBaseUrl}/assets/BatchCommerce.png`
  };
}

export async function sendResendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}) {
  const environment = getServerEnvironment();
  const body = JSON.stringify({
    from: SYSTEM_EMAIL_FROM,
    to: [input.to],
    subject: input.subject,
    text: input.text,
    html: input.html
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${environment.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": input.idempotencyKey
        },
        body,
        cache: "no-store"
      });
    } catch (cause) {
      if (attempt === 0) continue;
      throw new EmailDeliveryError(
        "Could not confirm whether Resend accepted the email.",
        false,
        { cause }
      );
    }

    if (response.ok) {
      const providerResult = (await response.json().catch(() => ({}))) as { id?: string };
      return { providerMessageId: providerResult.id || null };
    }

    const providerMessage = await response.text().catch(() => "");
    const definitivelyRejected =
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 408 &&
      response.status !== 409;
    if (!definitivelyRejected && attempt === 0) continue;

    throw new EmailDeliveryError(
      `Resend email request failed (${response.status}): ${providerMessage}`,
      definitivelyRejected
    );
  }

  throw new EmailDeliveryError("Could not confirm email delivery.", false);
}
