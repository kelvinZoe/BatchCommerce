-- Multi-shop core foundation
-- This migration introduces shared-tenant primitives for the new SaaS direction.
-- The existing data is test data, so this is intentionally a clean starting point.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL,
  app_user_id BIGINT,
  role_name TEXT NOT NULL DEFAULT 'Admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, auth_user_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_memberships_auth_user_id ON shop_memberships(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_shop_memberships_shop_id ON shop_memberships(shop_id);

CREATE OR REPLACE FUNCTION current_shop_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_shop_id', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read shops" ON shops;
CREATE POLICY "Authenticated can read shops"
  ON shops
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can manage shop memberships" ON shop_memberships;
CREATE POLICY "Authenticated can manage shop memberships"
  ON shop_memberships
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Next phase: add `shop_id` to core business tables and scope all queries with it.