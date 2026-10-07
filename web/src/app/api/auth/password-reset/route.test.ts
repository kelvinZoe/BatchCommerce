import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  sendPasswordResetEmail: vi.fn()
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit
}));
vi.mock("@/features/auth/server/password-reset-email", () => ({
  sendPasswordResetEmail: mocks.sendPasswordResetEmail
}));

import { POST } from "./route";

function resetRequest() {
  return new NextRequest("https://staging.example.com/api/auth/password-reset", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-vercel-forwarded-for": "203.0.113.8"
    },
    body: JSON.stringify({ email: "ama@example.com" })
  });
}

describe("POST /api/auth/password-reset", () => {
  beforeEach(() => {
    mocks.checkRateLimit.mockReset();
    mocks.sendPasswordResetEmail.mockReset();
  });

  it("returns Retry-After when the shared window is exhausted", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 73
    });

    const response = await POST(resetRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("73");
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("fails closed when the shared limiter is unavailable", async () => {
    mocks.checkRateLimit.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(resetRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("uses a request-scoped idempotency key for delivery", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 900
    });
    mocks.sendPasswordResetEmail.mockResolvedValue({ providerMessageId: "email-id" });

    const response = await POST(resetRequest());

    expect(response.status).toBe(200);
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith(
      "ama@example.com",
      expect.stringMatching(/^password-reset\/[0-9a-f-]{36}$/)
    );
  });
});
