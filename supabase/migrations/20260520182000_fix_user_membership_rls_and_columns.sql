ALTER TABLE public.shop_memberships
ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.shop_memberships
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

ALTER TABLE public.shop_memberships
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

ALTER TABLE public.shop_memberships
ADD COLUMN IF NOT EXISTS invited_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL;

UPDATE public.shop_memberships
SET membership_status = CASE WHEN is_active THEN 'active' ELSE 'suspended' END
WHERE membership_status IS NULL OR membership_status = '';

UPDATE public.shop_memberships
SET accepted_at = COALESCE(accepted_at, created_at)
WHERE is_active = TRUE AND accepted_at IS NULL;

CREATE OR REPLACE FUNCTION public.can_access_app_user(p_app_user_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.shop_memberships current_membership
      JOIN public.shop_memberships target_membership
        ON target_membership.shop_id = current_membership.shop_id
      WHERE current_membership.auth_user_id = auth.uid()
        AND current_membership.is_active = TRUE
        AND target_membership.app_user_id = p_app_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.app_users au
      WHERE au.id = p_app_user_id
        AND au.auth_id = auth.uid()
    )
  );
$$;

DROP POLICY IF EXISTS "Authenticated can read own app user" ON public.app_users;
DROP POLICY IF EXISTS "Authenticated can update own app user" ON public.app_users;
DROP POLICY IF EXISTS "Authenticated can read memberships" ON public.shop_memberships;
DROP POLICY IF EXISTS "Authenticated can insert memberships" ON public.shop_memberships;
DROP POLICY IF EXISTS "Authenticated can update memberships" ON public.shop_memberships;
DROP POLICY IF EXISTS "Authenticated can delete memberships" ON public.shop_memberships;

CREATE POLICY "Authenticated can read own app user"
  ON public.app_users
  FOR SELECT TO authenticated
  USING (
    auth_id = auth.uid()
    OR public.can_access_app_user(id)
  );

CREATE POLICY "Authenticated can update own app user"
  ON public.app_users
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid() OR public.can_access_app_user(id))
  WITH CHECK (auth_id = auth.uid() OR public.can_access_app_user(id));

CREATE POLICY "Authenticated can read memberships"
  ON public.shop_memberships
  FOR SELECT TO authenticated
  USING (public.has_shop_membership(shop_id));

CREATE POLICY "Authenticated can insert memberships"
  ON public.shop_memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.has_shop_membership(shop_id));

CREATE POLICY "Authenticated can update memberships"
  ON public.shop_memberships
  FOR UPDATE TO authenticated
  USING (public.has_shop_membership(shop_id))
  WITH CHECK (public.has_shop_membership(shop_id));

CREATE POLICY "Authenticated can delete memberships"
  ON public.shop_memberships
  FOR DELETE TO authenticated
  USING (public.has_shop_membership(shop_id));
