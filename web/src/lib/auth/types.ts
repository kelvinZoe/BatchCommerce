import type { User } from "@supabase/supabase-js";
import type { AppResource } from "./resources";

export type PermissionAction = "view" | "create" | "edit" | "delete";

export type PermissionGrant = {
  resource: AppResource;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type WorkspaceContext = {
  authUser: User;
  user: {
    id: number | null;
    username: string;
    fullName: string;
    email: string;
    isActive: boolean;
  };
  membership: {
    id: number;
    shopId: string;
    roleId: number | null;
    roleName: string;
    isOwner: boolean;
  };
  shop: {
    id: string;
    name: string;
    slug: string;
  };
  permissions: PermissionGrant[];
};

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message: string;
  fields?: {
    identifier?: string;
    email?: string;
    fullName?: string;
    phone?: string;
    shopName?: string;
  };
};

export const INITIAL_AUTH_STATE: AuthActionState = { status: "idle", message: "" };
