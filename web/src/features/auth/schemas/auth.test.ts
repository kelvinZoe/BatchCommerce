import { describe, expect, it } from "vitest";
import { loginSchema, passwordResetRequestSchema, updatePasswordSchema } from "./auth";

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
});
