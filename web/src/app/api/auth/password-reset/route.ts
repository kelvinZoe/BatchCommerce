import { NextResponse, type NextRequest } from "next/server";
import { passwordResetRequestSchema } from "@/features/auth/schemas/auth";
import { sendPasswordResetEmail } from "@/features/auth/server/password-reset-email";
import { checkRateLimit } from "@/lib/security/rate-limit";

const GENERIC_MESSAGE = (email: string) =>
  `If an account exists for ${email}, a password reset link has been sent.`;

function requestClientKey(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const limit = checkRateLimit(`password-reset:${requestClientKey(request)}`, {
    limit: 5,
    windowMs: 15 * 60 * 1_000
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many reset requests. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" }
      }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = passwordResetRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Enter a valid email address." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const delivery = await sendPasswordResetEmail(parsed.data.email, request.nextUrl.origin);
    console.info("Password reset email accepted by Resend", {
      requestId,
      providerMessageId: delivery.providerMessageId
    });
  } catch (error) {
    // The public response intentionally does not disclose account existence or
    // provider status. Deployment logs retain the actionable failure.
    console.error("Password reset email delivery failed", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown delivery error"
    });
  }

  return NextResponse.json(
    { success: true, message: GENERIC_MESSAGE(parsed.data.email), requestId },
    { headers: { "Cache-Control": "no-store" } }
  );
}
