-- Ensure tenant authorization also respects disabled shops and app profiles.
-- Application checks provide user-facing redirects; these helpers remain the
-- authoritative RLS boundary for direct PostgREST access.

CREATE OR REPLACE FUNCTION public.has_shop_membership(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shop_memberships sm
    JOIN public.shops s
      ON s.id = sm.shop_id
     AND s.is_active = TRUE
    JOIN public.app_users au
      ON au.id = sm.app_user_id
     AND au.auth_id = sm.auth_user_id
     AND au.is_active = TRUE
    WHERE sm.shop_id = p_shop_id
      AND sm.auth_user_id = auth.uid()
      AND sm.is_active = TRUE
      AND COALESCE(sm.membership_status, 'active') = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_shop_admin(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shop_memberships sm
    JOIN public.shops s
      ON s.id = sm.shop_id
     AND s.is_active = TRUE
    JOIN public.app_users au
      ON au.id = sm.app_user_id
     AND au.auth_id = sm.auth_user_id
     AND au.is_active = TRUE
    LEFT JOIN public.roles r
      ON r.id = sm.role_id
     AND r.shop_id = sm.shop_id
    WHERE sm.shop_id = p_shop_id
      AND sm.auth_user_id = auth.uid()
      AND sm.is_active = TRUE
      AND COALESCE(sm.membership_status, 'active') = 'active'
      AND (sm.is_owner = TRUE OR lower(COALESCE(r.name, '')) = 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_shop_permission(
  p_shop_id UUID,
  p_resource TEXT,
  p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shop_memberships sm
    JOIN public.shops s
      ON s.id = sm.shop_id
     AND s.is_active = TRUE
    JOIN public.app_users au
      ON au.id = sm.app_user_id
     AND au.auth_id = sm.auth_user_id
     AND au.is_active = TRUE
    LEFT JOIN public.roles r
      ON r.id = sm.role_id
     AND r.shop_id = sm.shop_id
    LEFT JOIN public.role_permissions rp
      ON rp.shop_id = sm.shop_id
     AND rp.role_id = sm.role_id
     AND rp.resource = p_resource
    WHERE sm.shop_id = p_shop_id
      AND sm.auth_user_id = auth.uid()
      AND sm.is_active = TRUE
      AND COALESCE(sm.membership_status, 'active') = 'active'
      AND (
        sm.is_owner = TRUE
        OR lower(COALESCE(r.name, '')) = 'admin'
        OR CASE p_action
          WHEN 'view' THEN COALESCE(rp.can_view, FALSE)
          WHEN 'create' THEN COALESCE(rp.can_create, FALSE)
          WHEN 'edit' THEN COALESCE(rp.can_edit, FALSE)
          WHEN 'delete' THEN COALESCE(rp.can_delete, FALSE)
          ELSE FALSE
        END
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_shop_membership(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_shop_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_shop_permission(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_shop_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_shop_permission(UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
