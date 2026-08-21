import { describe, expect, it } from "vitest";
import { isProtectedWorkspacePath } from "./route-access";

describe("isProtectedWorkspacePath", () => {
  it("protects catalog routes and their descendants", () => {
    expect(isProtectedWorkspacePath("/dashboard")).toBe(true);
    expect(isProtectedWorkspacePath("/orders/42")).toBe(true);
    expect(isProtectedWorkspacePath("/access-denied")).toBe(true);
  });

  it("leaves authentication routes public", () => {
    expect(isProtectedWorkspacePath("/login")).toBe(false);
    expect(isProtectedWorkspacePath("/reset-password")).toBe(false);
    expect(isProtectedWorkspacePath("/auth/callback")).toBe(false);
  });
});
