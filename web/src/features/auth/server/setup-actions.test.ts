import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createSignupVerification: vi.fn(),
  sendVerificationEmail: vi.fn(),
  rollbackSignupVerification: vi.fn()
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-vercel-forwarded-for": "203.0.113.8" }),
  cookies: vi.fn()
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("./email", () => ({
  wasEmailDefinitivelyRejected: (error: unknown) =>
    Boolean((error as { definitivelyRejected?: boolean })?.definitivelyRejected)
}));
vi.mock("./verification-email", () => ({
  createSignupVerification: mocks.createSignupVerification,
  sendVerificationEmail: mocks.sendVerificationEmail,
  rollbackSignupVerification: mocks.rollbackSignupVerification
}));

import { registerAccountAction } from "./setup-actions";

describe("registerAccountAction", () => {
  beforeEach(() => {
    mocks.checkRateLimit.mockReset();
    mocks.createSignupVerification.mockReset();
    mocks.sendVerificationEmail.mockReset();
    mocks.rollbackSignupVerification.mockReset();
    mocks.checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 3_600
    });
  });

  it("returns an error and rolls back an unconfirmed user when delivery fails", async () => {
    mocks.createSignupVerification.mockResolvedValue({
      authUserId: "auth-user-id",
      verificationLink: "https://example.supabase.co/verify"
    });
    mocks.sendVerificationEmail.mockRejectedValue(
      Object.assign(new Error("Resend rejected email"), { definitivelyRejected: true })
    );
    mocks.rollbackSignupVerification.mockResolvedValue(true);

    const formData = new FormData();
    formData.set("fullName", "Ama Mensah");
    formData.set("email", "ama@example.com");
    formData.set("phone", "024 000 0000");
    formData.set("password", "secret1");

    const result = await registerAccountAction(
      { status: "idle", message: "" },
      formData
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("no account was kept");
    expect(mocks.rollbackSignupVerification).toHaveBeenCalledWith("auth-user-id");
    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^verification\/[0-9a-f-]{36}$/)
      })
    );
    expect(mocks.checkRateLimit).toHaveBeenCalledWith("register", "203.0.113.8", {
      limit: 5,
      windowMs: 3_600_000
    });
  });

  it("keeps an unconfirmed user when provider acceptance is ambiguous", async () => {
    mocks.createSignupVerification.mockResolvedValue({
      authUserId: "auth-user-id",
      verificationLink: "https://example.supabase.co/verify"
    });
    mocks.sendVerificationEmail.mockRejectedValue(
      Object.assign(new Error("network timeout"), { definitivelyRejected: false })
    );

    const formData = new FormData();
    formData.set("fullName", "Ama Mensah");
    formData.set("email", "ama@example.com");
    formData.set("phone", "+233240000000");
    formData.set("password", "secret1");

    const result = await registerAccountAction(
      { status: "idle", message: "" },
      formData
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("contact BatchCommerce Support");
    expect(mocks.rollbackSignupVerification).not.toHaveBeenCalled();
  });

  it("stops before user creation when shared throttling is unavailable", async () => {
    mocks.checkRateLimit.mockRejectedValue(new Error("database unavailable"));

    const formData = new FormData();
    formData.set("fullName", "Ama Mensah");
    formData.set("email", "ama@example.com");
    formData.set("phone", "+233240000000");
    formData.set("password", "secret1");

    const result = await registerAccountAction(
      { status: "idle", message: "" },
      formData
    );

    expect(result).toMatchObject({
      status: "error",
      message: "Registration is temporarily unavailable. Please try again."
    });
    expect(mocks.createSignupVerification).not.toHaveBeenCalled();
  });
});
