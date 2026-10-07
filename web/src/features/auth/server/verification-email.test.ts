import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  deleteUser: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    auth: {
      admin: {
        getUserById: mocks.getUserById,
        deleteUser: mocks.deleteUser
      }
    }
  })
}));
vi.mock("./email", () => ({
  escapeHtml: (value: string) => value,
  getEmailBranding: () => ({
    appBaseUrl: "https://staging.example.com",
    logoUrl: "https://staging.example.com/logo.png"
  }),
  sendResendEmail: vi.fn()
}));

import { rollbackSignupVerification } from "./verification-email";

describe("rollbackSignupVerification", () => {
  beforeEach(() => {
    mocks.getUserById.mockReset();
    mocks.deleteUser.mockReset();
  });

  it("deletes a newly created user that is still unconfirmed", async () => {
    mocks.getUserById.mockResolvedValue({
      data: { user: { id: "auth-user-id", email_confirmed_at: null } },
      error: null
    });
    mocks.deleteUser.mockResolvedValue({ data: {}, error: null });

    await expect(rollbackSignupVerification("auth-user-id")).resolves.toBe(true);
    expect(mocks.deleteUser).toHaveBeenCalledWith("auth-user-id");
  });

  it("never deletes a user whose email is already confirmed", async () => {
    mocks.getUserById.mockResolvedValue({
      data: { user: { id: "auth-user-id", email_confirmed_at: "2026-09-04T12:00:00Z" } },
      error: null
    });

    await expect(rollbackSignupVerification("auth-user-id")).resolves.toBe(false);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("surfaces cleanup failures instead of claiming rollback succeeded", async () => {
    mocks.getUserById.mockResolvedValue({
      data: { user: { id: "auth-user-id", email_confirmed_at: null } },
      error: null
    });
    mocks.deleteUser.mockResolvedValue({ data: null, error: new Error("delete failed") });

    await expect(rollbackSignupVerification("auth-user-id")).rejects.toThrow(
      "delete failed"
    );
  });
});
