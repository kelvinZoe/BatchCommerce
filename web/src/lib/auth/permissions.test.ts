import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";
import type { WorkspaceContext } from "./types";

function context(overrides: Partial<WorkspaceContext["membership"]> = {}): WorkspaceContext {
  return {
    authUser: { id: "auth-user" } as WorkspaceContext["authUser"],
    user: { id: 1, username: "zoe", fullName: "Zoe", email: "zoe@example.com", isActive: true },
    membership: {
      id: 2,
      shopId: "shop",
      roleId: 3,
      roleName: "Member",
      isOwner: false,
      ...overrides
    },
    shop: { id: "shop", name: "Test Shop", slug: "test-shop" },
    permissions: [
      { resource: "orders", canView: true, canCreate: false, canEdit: false, canDelete: false }
    ]
  };
}

describe("hasPermission", () => {
  it("uses the configured resource grant", () => {
    expect(hasPermission(context(), "orders", "view")).toBe(true);
    expect(hasPermission(context(), "orders", "edit")).toBe(false);
    expect(hasPermission(context(), "products", "view")).toBe(false);
  });

  it("gives owners and admins full application access", () => {
    expect(hasPermission(context({ isOwner: true }), "roles", "delete")).toBe(true);
    expect(hasPermission(context({ roleName: "ADMIN" }), "roles", "delete")).toBe(true);
  });
});
