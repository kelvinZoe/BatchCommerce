import { describe, expect, it } from "vitest";
import {
  loginSchema,
  passwordResetRequestSchema,
  registrationSchema,
  updatePasswordSchema,
  workspaceBootstrapResultSchema,
  workspaceSetupSchema
} from "./auth";

describe("auth schemas", () => {
  it("normalizes password reset email addresses", () => {
    expect(passwordResetRequestSchema.parse({ email: "  Zoe@Example.com " }).email).toBe(
      "zoe@example.com"
    );
  });

  it("reports a missing password-reset email clearly", () => {
    const result = passwordResetRequestSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("Email is required.");
  });

  it("requires a login identifier and password", () => {
    expect(loginSchema.safeParse({ identifier: "", password: "" }).success).toBe(false);
  });

  it("rejects short or mismatched replacement passwords", () => {
    expect(
      updatePasswordSchema.safeParse({ password: "short", confirmPassword: "short" }).success
    ).toBe(false);
    expect(
      updatePasswordSchema.safeParse({ password: "password", confirmPassword: "different" })
        .success
    ).toBe(false);
  });

  it("normalizes Ghana phone numbers during registration", () => {
    const result = registrationSchema.parse({
      fullName: "Ama Mensah",
      email: " AMA@EXAMPLE.COM ",
      phone: "024 000 0000",
      password: "secure-password"
    });

    expect(result.email).toBe("ama@example.com");
    expect(result.phone).toBe("+233240000000");
  });

  it("rejects incomplete workspace setup details", () => {
    expect(
      workspaceSetupSchema.safeParse({ fullName: "A", phone: "123", shopName: "" }).success
    ).toBe(false);
  });

  it("validates the workspace bootstrap RPC contract", () => {
    expect(
      workspaceBootstrapResultSchema.safeParse({
        appUserId: 1,
        shopId: "8bcbb7ff-8c6a-483f-b70e-f87801833649",
        shopName: "Ama's Boutique",
        shopSlug: "amas-boutique",
        roleId: 1,
        roleName: "Admin",
        membershipId: 1,
        username: "ama",
        email: "ama@example.com"
      }).success
    ).toBe(true);
  });
});
