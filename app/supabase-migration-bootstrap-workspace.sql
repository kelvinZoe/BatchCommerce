-- ============================================================
-- Batch Commerce - Workspace Bootstrap Helpers
-- Adds a self-serve onboarding RPC for account + shop creation.
-- Run this after the reset schema on the new Supabase project.
-- ============================================================

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS owner_device_id TEXT;

CREATE OR REPLACE FUNCTION bootstrap_shop_workspace(
  p_shop_name TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT '',
  p_shop_slug TEXT DEFAULT NULL,
  p_owner_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_email TEXT := lower(btrim(COALESCE(p_email, '')));
  v_full_name TEXT := btrim(COALESCE(p_full_name, ''));
  v_phone TEXT := btrim(COALESCE(p_phone, ''));
  v_shop_name TEXT := btrim(COALESCE(p_shop_name, ''));
  v_owner_device_id TEXT := NULLIF(left(btrim(COALESCE(p_owner_device_id, '')), 120), '');
  v_base_slug TEXT;
  v_shop_slug TEXT;
  v_username TEXT;
  v_app_user_id BIGINT;
  v_shop_id UUID;
  v_role_id BIGINT;
  v_membership_id BIGINT;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_full_name = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF v_shop_name = '' THEN
    RAISE EXCEPTION 'Shop name is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM shop_memberships
    WHERE auth_user_id = v_auth_user_id
      AND is_owner = TRUE
      AND is_active = TRUE
      AND COALESCE(membership_status, 'active') <> 'removed'
  ) THEN
    RAISE EXCEPTION 'This account already owns a shop. Each account can create only one shop.';
  END IF;

  IF v_owner_device_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM shop_memberships sm
    JOIN shops s ON s.id = sm.shop_id
    WHERE NULLIF(btrim(s.owner_device_id), '') = v_owner_device_id
      AND sm.is_owner = TRUE
      AND sm.is_active = TRUE
      AND COALESCE(sm.membership_status, 'active') <> 'removed'
  ) THEN
    RAISE EXCEPTION 'This device has already created a shop. Each device can start only one owner shop promo.';
  END IF;

  SELECT id
    INTO v_app_user_id
  FROM app_users
  WHERE auth_id = v_auth_user_id;

  IF v_app_user_id IS NULL THEN
    v_username := regexp_replace(split_part(v_email, '@', 1), '[^a-zA-Z0-9._-]+', '', 'g');
    IF v_username = '' THEN
      v_username := regexp_replace(lower(v_full_name), '[^a-zA-Z0-9._-]+', '.', 'g');
    END IF;
    v_username := regexp_replace(v_username, '^\.+|\.+$', '', 'g');
    IF v_username = '' THEN
      v_username := 'user';
    END IF;

    WHILE EXISTS (
      SELECT 1
      FROM app_users
      WHERE username = v_username
    ) LOOP
      v_username := v_username || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    END LOOP;

    INSERT INTO app_users (
      auth_id,
      username,
      full_name,
      phone,
      email,
      is_active
    ) VALUES (
      v_auth_user_id,
      v_username,
      v_full_name,
      v_phone,
      v_email,
      TRUE
    )
    RETURNING id INTO v_app_user_id;
  ELSE
    UPDATE app_users
      SET full_name = v_full_name,
          phone = COALESCE(NULLIF(v_phone, ''), phone),
          email = v_email,
          is_active = TRUE,
          updated_at = now()
    WHERE id = v_app_user_id;
  END IF;

  v_base_slug := lower(COALESCE(NULLIF(btrim(p_shop_slug), ''), v_shop_name));
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9]+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '(^-|-$)', '', 'g');

  IF v_base_slug = '' THEN
    v_base_slug := 'shop';
  END IF;

  v_shop_slug := v_base_slug;
  WHILE EXISTS (
    SELECT 1
    FROM shops
    WHERE slug = v_shop_slug
  ) LOOP
    v_shop_slug := v_base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  END LOOP;

  INSERT INTO shops (
    name,
    slug,
    owner_device_id,
    is_active
  ) VALUES (
    v_shop_name,
    v_shop_slug,
    v_owner_device_id,
    TRUE
  )
  RETURNING id INTO v_shop_id;

  INSERT INTO roles (
    shop_id,
    name,
    description,
    is_system,
    created_by,
    updated_by
  ) VALUES (
    v_shop_id,
    'Admin',
    'Workspace owner with full access',
    TRUE,
    v_app_user_id,
    v_app_user_id
  )
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (
    shop_id,
    role_id,
    resource,
    can_view,
    can_create,
    can_edit,
    can_delete,
    created_by,
    updated_by
  )
  SELECT
    v_shop_id,
    v_role_id,
    resource,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    v_app_user_id,
    v_app_user_id
  FROM (
    VALUES
      ('dashboard'),
      ('clients'),
      ('products'),
      ('orders'),
      ('buying_list'),
      ('arrivals'),
      ('product_tracking'),
      ('shipping'),
      ('deliveries'),
      ('stock_sales'),
      ('damaged_items'),
      ('reports'),
      ('import'),
      ('users'),
      ('roles'),
      ('settings'),
      ('batches'),
      ('expenses')
  ) AS permissions(resource);

  INSERT INTO shop_memberships (
    shop_id,
    auth_user_id,
    app_user_id,
    role_id,
    is_owner,
    is_active,
    last_selected_at,
    created_by,
    updated_by
  ) VALUES (
    v_shop_id,
    v_auth_user_id,
    v_app_user_id,
    v_role_id,
    TRUE,
    TRUE,
    now(),
    v_app_user_id,
    v_app_user_id
  )
  RETURNING id INTO v_membership_id;

  RETURN jsonb_build_object(
    'appUserId', v_app_user_id,
    'shopId', v_shop_id,
    'shopName', v_shop_name,
    'shopSlug', v_shop_slug,
    'roleId', v_role_id,
    'roleName', 'Admin',
    'membershipId', v_membership_id,
    'username', v_username,
    'email', v_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION bootstrap_shop_workspace(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
