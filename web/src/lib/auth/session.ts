import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasPermission } from "./permissions";
import { isAppResource, type AppResource } from "./resources";
import type { PermissionAction, PermissionGrant, WorkspaceContext } from "./types";

export const ACTIVE_SHOP_COOKIE = "batchcommerce_active_shop";

type AppSupabaseClient = SupabaseClient<Database>;

export async function resolveWorkspaceForUser(
  supabase: AppSupabaseClient,
  authUser: User,
  preferredShopId?: string | null
): Promise<WorkspaceContext | null> {
  const baseQuery = () =>
    supabase
      .from("shop_memberships")
      .select("id, shop_id, app_user_id, role_id, is_owner, is_active, membership_status, last_selected_at")
      .eq("auth_user_id", authUser.id)
      .eq("is_active", true)
      .eq("membership_status", "active")
      .order("is_owner", { ascending: false })
      .order("last_selected_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(1);

  let membershipResult = preferredShopId
    ? await baseQuery().eq("shop_id", preferredShopId)
    : await baseQuery();

  if (!membershipResult.error && !membershipResult.data?.length && preferredShopId) {
    membershipResult = await baseQuery();
  }

  if (membershipResult.error) {
    throw new Error("Could not resolve your BatchCommerce workspace.");
  }

  const membership = membershipResult.data?.[0];
  if (!membership) return null;

  const [shopResult, profileResult, roleResult, permissionResult] = await Promise.all([
    supabase.from("shops").select("id, name, slug, is_active").eq("id", membership.shop_id).maybeSingle(),
    membership.app_user_id
      ? supabase
          .from("app_users")
          .select("id, auth_id, username, full_name, email, is_active")
          .eq("id", membership.app_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    membership.role_id
      ? supabase.from("roles").select("id, shop_id, name").eq("id", membership.role_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    membership.role_id
      ? supabase
          .from("role_permissions")
          .select("resource, can_view, can_create, can_edit, can_delete")
          .eq("shop_id", membership.shop_id)
          .eq("role_id", membership.role_id)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (shopResult.error || !shopResult.data || !shopResult.data.is_active) return null;
  if (profileResult.error || roleResult.error || permissionResult.error) {
    throw new Error("Could not load your BatchCommerce access profile.");
  }
  if (!profileResult.data || profileResult.data.auth_id !== authUser.id || !profileResult.data.is_active) {
    return null;
  }
  if (!membership.is_owner && (!roleResult.data || roleResult.data.shop_id !== membership.shop_id)) {
    return null;
  }
  if (roleResult.data && roleResult.data.shop_id !== membership.shop_id) return null;

  const permissions: PermissionGrant[] = (permissionResult.data ?? [])
    .filter((row): row is typeof row & { resource: AppResource } => isAppResource(row.resource))
    .map((row) => ({
      resource: row.resource as AppResource,
      canView: row.can_view,
      canCreate: row.can_create,
      canEdit: row.can_edit,
      canDelete: row.can_delete
    }));

  const profile = profileResult.data;
  return {
    authUser,
    user: {
      id: profile.id,
      username:
        profile.username ||
        String(authUser.user_metadata.username || "") ||
        authUser.email?.split("@")[0] ||
        "user",
      fullName:
        profile.full_name ||
        String(authUser.user_metadata.full_name || "") ||
        authUser.email ||
        "User",
      email: profile.email || authUser.email || "",
      isActive: profile.is_active
    },
    membership: {
      id: membership.id,
      shopId: membership.shop_id,
      roleId: membership.role_id,
      roleName: roleResult.data?.name || (membership.is_owner ? "Owner" : "Member"),
      isOwner: membership.is_owner
    },
    shop: {
      id: shopResult.data.id,
      name: shopResult.data.name,
      slug: shopResult.data.slug
    },
    permissions
  };
}

export const getAuthenticatedUser = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return null;

  const supabase = await createServerSupabaseClient();
  const cookieStore = await cookies();
  const preferredShopId = cookieStore.get(ACTIVE_SHOP_COOKIE)?.value || null;
  return resolveWorkspaceForUser(supabase, authUser, preferredShopId);
});

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireWorkspace(): Promise<WorkspaceContext> {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const context = await getWorkspaceContext();
  if (!context) redirect("/setup");
  return context;
}

export async function requirePermission(
  resource: AppResource,
  action: PermissionAction = "view"
): Promise<WorkspaceContext> {
  const context = await requireWorkspace();
  if (!hasPermission(context, resource, action)) {
    redirect(`/access-denied?resource=${encodeURIComponent(resource)}`);
  }
  return context;
}
