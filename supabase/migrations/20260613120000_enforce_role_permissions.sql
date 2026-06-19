-- Phase 5 security hardening: enforce role permissions at the database layer.
-- UI guards are helpful, but RLS must be the source of truth for direct REST calls.

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
    LEFT JOIN public.roles r ON r.id = sm.role_id AND r.shop_id = sm.shop_id
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
    LEFT JOIN public.roles r ON r.id = sm.role_id AND r.shop_id = sm.shop_id
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

CREATE OR REPLACE FUNCTION public.can_manage_app_user(
  p_app_user_id BIGINT,
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
    FROM public.shop_memberships current_membership
    JOIN public.shop_memberships target_membership
      ON target_membership.shop_id = current_membership.shop_id
    WHERE current_membership.auth_user_id = auth.uid()
      AND current_membership.is_active = TRUE
      AND COALESCE(current_membership.membership_status, 'active') = 'active'
      AND target_membership.app_user_id = p_app_user_id
      AND public.has_shop_permission(current_membership.shop_id, 'users', p_action)
  );
$$;

DROP POLICY IF EXISTS "Authenticated can read shops" ON public.shops;
DROP POLICY IF EXISTS "Authenticated can insert shops" ON public.shops;
DROP POLICY IF EXISTS "Authenticated can update shops" ON public.shops;

CREATE POLICY "Members can read their shops"
  ON public.shops
  FOR SELECT TO authenticated
  USING (public.has_shop_membership(id));

CREATE POLICY "Workspace bootstrap creates shops"
  ON public.shops
  FOR INSERT TO authenticated
  WITH CHECK (FALSE);

CREATE POLICY "Settings editors can update shops"
  ON public.shops
  FOR UPDATE TO authenticated
  USING (public.has_shop_permission(id, 'settings', 'edit'))
  WITH CHECK (public.has_shop_permission(id, 'settings', 'edit'));

DROP POLICY IF EXISTS "Authenticated can read own app user" ON public.app_users;
DROP POLICY IF EXISTS "Authenticated can insert app users" ON public.app_users;
DROP POLICY IF EXISTS "Authenticated can update own app user" ON public.app_users;

CREATE POLICY "Users can read own or managed app users"
  ON public.app_users
  FOR SELECT TO authenticated
  USING (auth_id = auth.uid() OR public.can_manage_app_user(id, 'view'));

CREATE POLICY "Users can insert own app user"
  ON public.app_users
  FOR INSERT TO authenticated
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "Users can update own or managed app users"
  ON public.app_users
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid() OR public.can_manage_app_user(id, 'edit'))
  WITH CHECK (auth_id = auth.uid() OR public.can_manage_app_user(id, 'edit'));

DROP POLICY IF EXISTS "Authenticated can read memberships" ON public.shop_memberships;
DROP POLICY IF EXISTS "Authenticated can insert memberships" ON public.shop_memberships;
DROP POLICY IF EXISTS "Authenticated can update memberships" ON public.shop_memberships;
DROP POLICY IF EXISTS "Authenticated can delete memberships" ON public.shop_memberships;

CREATE POLICY "Users can read own or managed memberships"
  ON public.shop_memberships
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.has_shop_permission(shop_id, 'users', 'view'));

CREATE POLICY "User creators can insert memberships"
  ON public.shop_memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.has_shop_permission(shop_id, 'users', 'create'));

CREATE POLICY "User editors can update memberships"
  ON public.shop_memberships
  FOR UPDATE TO authenticated
  USING (public.has_shop_permission(shop_id, 'users', 'edit'))
  WITH CHECK (public.has_shop_permission(shop_id, 'users', 'edit'));

CREATE POLICY "User deleters can delete memberships"
  ON public.shop_memberships
  FOR DELETE TO authenticated
  USING (public.has_shop_permission(shop_id, 'users', 'delete'));

DROP POLICY IF EXISTS "Authenticated can read roles" ON public.roles;
DROP POLICY IF EXISTS "Authenticated can write roles" ON public.roles;
DROP POLICY IF EXISTS "Authenticated can update roles" ON public.roles;

CREATE POLICY "Users can read own or managed roles"
  ON public.roles
  FOR SELECT TO authenticated
  USING (
    public.has_shop_permission(shop_id, 'roles', 'view')
    OR EXISTS (
      SELECT 1
      FROM public.shop_memberships sm
      WHERE sm.shop_id = roles.shop_id
        AND sm.role_id = roles.id
        AND sm.auth_user_id = auth.uid()
        AND sm.is_active = TRUE
        AND COALESCE(sm.membership_status, 'active') = 'active'
    )
  );

CREATE POLICY "Role creators can insert roles"
  ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_shop_permission(shop_id, 'roles', 'create'));

CREATE POLICY "Role editors can update roles"
  ON public.roles
  FOR UPDATE TO authenticated
  USING (public.has_shop_permission(shop_id, 'roles', 'edit'))
  WITH CHECK (public.has_shop_permission(shop_id, 'roles', 'edit'));

CREATE POLICY "Role deleters can delete roles"
  ON public.roles
  FOR DELETE TO authenticated
  USING (public.has_shop_permission(shop_id, 'roles', 'delete') AND is_system = FALSE);

DROP POLICY IF EXISTS "Authenticated can read role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Authenticated can write role_permissions" ON public.role_permissions;

CREATE POLICY "Users can read own or managed role permissions"
  ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    public.has_shop_permission(shop_id, 'roles', 'view')
    OR EXISTS (
      SELECT 1
      FROM public.shop_memberships sm
      WHERE sm.shop_id = role_permissions.shop_id
        AND sm.role_id = role_permissions.role_id
        AND sm.auth_user_id = auth.uid()
        AND sm.is_active = TRUE
        AND COALESCE(sm.membership_status, 'active') = 'active'
    )
  );

CREATE POLICY "Role editors can insert role permissions"
  ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_shop_permission(shop_id, 'roles', 'edit'));

CREATE POLICY "Role editors can update role permissions"
  ON public.role_permissions
  FOR UPDATE TO authenticated
  USING (public.has_shop_permission(shop_id, 'roles', 'edit'))
  WITH CHECK (public.has_shop_permission(shop_id, 'roles', 'edit'));

CREATE POLICY "Role editors can delete role permissions"
  ON public.role_permissions
  FOR DELETE TO authenticated
  USING (public.has_shop_permission(shop_id, 'roles', 'edit'));

DO $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('batches', 'batches'),
      ('products', 'products'),
      ('batch_products', 'products'),
      ('customers', 'clients'),
      ('orders', 'orders'),
      ('order_items', 'orders'),
      ('buying_list', 'buying_list'),
      ('arrival_items', 'arrivals'),
      ('damaged_items', 'damaged_items'),
      ('damage_order_allocations', 'damaged_items'),
      ('follow_ups', 'product_tracking'),
      ('product_tracking', 'product_tracking'),
      ('batch_product_shipping', 'shipping'),
      ('shipping_invoices', 'shipping'),
      ('shipping_invoice_items', 'shipping'),
      ('shipping_batches', 'shipping'),
      ('shipping_fees', 'shipping'),
      ('shipping_payments', 'shipping'),
      ('deliveries', 'deliveries'),
      ('stock_sales', 'stock_sales'),
      ('stock_sale_items', 'stock_sales'),
      ('expenses', 'expenses')
    ) AS policies(table_name, resource)
  LOOP
    IF to_regclass('public.' || item.table_name) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Authenticated can read ' || item.table_name, item.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Authenticated can write ' || item.table_name, item.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Role can view ' || item.table_name, item.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Role can create ' || item.table_name, item.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Role can edit ' || item.table_name, item.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Role can delete ' || item.table_name, item.table_name);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_shop_permission(shop_id, %L, %L))',
      'Role can view ' || item.table_name,
      item.table_name,
      item.resource,
      'view'
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_shop_permission(shop_id, %L, %L))',
      'Role can create ' || item.table_name,
      item.table_name,
      item.resource,
      'create'
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_shop_permission(shop_id, %L, %L)) WITH CHECK (public.has_shop_permission(shop_id, %L, %L))',
      'Role can edit ' || item.table_name,
      item.table_name,
      item.resource,
      'edit',
      item.resource,
      'edit'
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_shop_permission(shop_id, %L, %L))',
      'Role can delete ' || item.table_name,
      item.table_name,
      item.resource,
      'delete'
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Authenticated can read audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated can insert audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Role can view audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Role can insert audit_log" ON public.audit_log;

CREATE POLICY "Role can view audit_log"
  ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_shop_admin(shop_id));

CREATE POLICY "Role can insert audit_log"
  ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_admin(shop_id));
