import type { AppResource } from "./resources";
import type { PermissionAction, WorkspaceContext } from "./types";

const permissionProperty = {
  view: "canView",
  create: "canCreate",
  edit: "canEdit",
  delete: "canDelete"
} as const;

export function hasPermission(
  context: WorkspaceContext,
  resource: AppResource,
  action: PermissionAction = "view"
): boolean {
  if (context.membership.isOwner || context.membership.roleName.toLowerCase() === "admin") {
    return true;
  }

  const permission = context.permissions.find((item) => item.resource === resource);
  return permission?.[permissionProperty[action]] ?? false;
}
