-- ============================================================
-- Shakhis Commerce - Multi-Shop Reset Schema
-- Canonical tenant-aware schema for the new shared Supabase setup.
-- Existing data is test-only, so this file intentionally resets the
-- database to a clean multi-shop model.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- DROP OLD TABLES
-- ============================================================

DROP TABLE IF EXISTS stock_sale_items CASCADE;
DROP TABLE IF EXISTS stock_sales CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS shipping_payments CASCADE;
DROP TABLE IF EXISTS shipping_fees CASCADE;
DROP TABLE IF EXISTS shipping_batches CASCADE;
DROP TABLE IF EXISTS shipping_invoice_items CASCADE;
DROP TABLE IF EXISTS shipping_invoices CASCADE;
DROP TABLE IF EXISTS batch_product_shipping CASCADE;
DROP TABLE IF EXISTS product_tracking CASCADE;
DROP TABLE IF EXISTS follow_ups CASCADE;
DROP TABLE IF EXISTS damaged_items CASCADE;
DROP TABLE IF EXISTS arrival_items CASCADE;
DROP TABLE IF EXISTS buying_list CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS batch_products CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS shop_memberships CASCADE;
DROP TABLE IF EXISTS shops CASCADE;
DROP TABLE IF EXISTS app_users CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION current_shop_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_shop_id TEXT;
BEGIN
  -- 1. Try to read from JWT user_metadata
  v_shop_id := auth.jwt() -> 'user_metadata' ->> 'shop_id';
  IF v_shop_id IS NOT NULL AND v_shop_id <> '' THEN
    RETURN v_shop_id::UUID;
  END IF;

  -- 2. Try to read from JWT app_metadata
  v_shop_id := auth.jwt() -> 'app_metadata' ->> 'shop_id';
  IF v_shop_id IS NOT NULL AND v_shop_id <> '' THEN
    RETURN v_shop_id::UUID;
  END IF;

  -- 3. Fallback to active membership in shop_memberships table
  SELECT shop_id::text INTO v_shop_id
  FROM public.shop_memberships
  WHERE auth_user_id = auth.uid()
    AND is_active = TRUE
  ORDER BY last_selected_at DESC NULLS LAST
  LIMIT 1;

  IF v_shop_id IS NOT NULL AND v_shop_id <> '' THEN
    RETURN v_shop_id::UUID;
  END IF;

  -- 4. Fallback to transaction setting (for migration scripts/seeds)
  RETURN NULLIF(current_setting('app.current_shop_id', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION set_shop_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.shop_id IS NULL THEN
      NEW.shop_id := current_shop_id();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_actor_fields()
RETURNS TRIGGER AS $$
DECLARE
  actor_id BIGINT;
  payload JSONB;
BEGIN
  actor_id := current_app_user_id();
  payload := to_jsonb(NEW);

  IF TG_OP = 'INSERT' THEN
    IF NOT (payload ? 'created_by') OR COALESCE(payload->>'created_by', '') = '' THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object('created_by', actor_id));
    END IF;
    IF TG_ARGV[0] IS DISTINCT FROM 'created_only' AND (NOT (payload ? 'updated_by') OR COALESCE(payload->>'updated_by', '') = '') THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object('updated_by', actor_id));
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT (payload ? 'updated_by') OR COALESCE(payload->>'updated_by', '') = '' THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object('updated_by', actor_id));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION audit_log_write()
RETURNS TRIGGER AS $$
DECLARE
  actor_id BIGINT;
  entity_uuid_val UUID;
  payload JSONB;
  shop_uuid UUID;
BEGIN
  actor_id := current_app_user_id();

  IF TG_OP = 'DELETE' THEN
    payload := to_jsonb(OLD);
  ELSE
    payload := to_jsonb(NEW);
  END IF;

  shop_uuid := NULLIF(payload->>'shop_id', '')::UUID;

  IF shop_uuid IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    entity_uuid_val := COALESCE(
      NULLIF(payload->>'order_uuid', '')::uuid,
      NULLIF(payload->>'sale_uuid', '')::uuid
    );

    INSERT INTO audit_log (
      shop_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      entity_uuid,
      before_data,
      after_data
    ) VALUES (
      shop_uuid,
      actor_id,
      'insert',
      TG_TABLE_NAME,
      NULLIF(payload->>'id', '')::BIGINT,
      entity_uuid_val,
      NULL,
      payload
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    entity_uuid_val := COALESCE(
      NULLIF(payload->>'order_uuid', '')::uuid,
      NULLIF(payload->>'sale_uuid', '')::uuid
    );

    INSERT INTO audit_log (
      shop_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      entity_uuid,
      before_data,
      after_data
    ) VALUES (
      shop_uuid,
      actor_id,
      'update',
      TG_TABLE_NAME,
      NULLIF(payload->>'id', '')::BIGINT,
      entity_uuid_val,
      to_jsonb(OLD),
      payload
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    entity_uuid_val := COALESCE(
      NULLIF(payload->>'order_uuid', '')::uuid,
      NULLIF(payload->>'sale_uuid', '')::uuid
    );

    INSERT INTO audit_log (
      shop_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      entity_uuid,
      before_data,
      after_data
    ) VALUES (
      shop_uuid,
      actor_id,
      'delete',
      TG_TABLE_NAME,
      NULLIF(payload->>'id', '')::BIGINT,
      entity_uuid_val,
      payload,
      NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sync_user_active_shop()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('shop_id', NEW.shop_id)
    WHERE id = NEW.auth_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ============================================================
-- CORE TENANT TABLES
-- ============================================================

CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app_users (
  id BIGSERIAL PRIMARY KEY,
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);

CREATE TABLE role_permissions (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  dashboard_config JSONB,
  product_config JSONB,
  orders_config JSONB,
  buying_list_config JSONB,
  arrivals_config JSONB,
  shipping_config JSONB,
  shipping_ledger_config JSONB,
  stock_sales_config JSONB,
  manage_batches_config JSONB,
  roles_config JSONB,
  users_config JSONB,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_id, resource)
);

CREATE TABLE shop_memberships (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  role_id BIGINT REFERENCES roles(id) ON DELETE SET NULL,
  is_owner BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  membership_status TEXT NOT NULL DEFAULT 'active',
  accepted_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  invited_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  last_selected_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, auth_user_id)
);

-- ============================================================
-- BUSINESS TABLES
-- ============================================================

CREATE TABLE batches (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  order_status TEXT NOT NULL DEFAULT 'pending',
  buying_status TEXT NOT NULL DEFAULT 'pending',
  delivery_status TEXT NOT NULL DEFAULT 'not_sent',
  arrivals_sent BOOLEAN NOT NULL DEFAULT FALSE,
  stock_applied BOOLEAN NOT NULL DEFAULT FALSE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);

CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  preorder_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_discount_min_qty INTEGER NOT NULL DEFAULT 0,
  stock_discount_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);

CREATE TABLE batch_products (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  preorder_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  preorder_discount_min_qty INTEGER NOT NULL DEFAULT 0,
  preorder_discount_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_discount_min_qty INTEGER NOT NULL DEFAULT 0,
  stock_discount_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  in_stock_qty INTEGER NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, product_id)
);

CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  whatsapp_number TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  order_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  notes TEXT DEFAULT '',
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'paid',
  refunded BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_uuid)
);

CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE RESTRICT,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE buying_list (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  source TEXT NOT NULL DEFAULT 'client',
  requested_qty INTEGER NOT NULL DEFAULT 0,
  ordered_qty INTEGER NOT NULL DEFAULT 0,
  in_stock_qty INTEGER NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  moved_to_arrivals BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, batch_product_id)
);

CREATE TABLE arrival_items (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  requested_qty INTEGER NOT NULL DEFAULT 0,
  received_qty INTEGER NOT NULL DEFAULT 0,
  confirmed_qty INTEGER NOT NULL DEFAULT 0,
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  sent_to_shipping BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, batch_product_id)
);

CREATE TABLE damaged_items (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  requested_qty INTEGER NOT NULL DEFAULT 0,
  damaged_qty INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT 'damaged_in_transit',
  notes TEXT DEFAULT '',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE damage_order_allocations (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  order_item_id BIGINT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  batch_id BIGINT REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT REFERENCES batch_products(id) ON DELETE SET NULL,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  client_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  batch_name TEXT,
  original_quantity INTEGER NOT NULL DEFAULT 0,
  adjusted_quantity INTEGER NOT NULL DEFAULT 0,
  damaged_quantity INTEGER NOT NULL DEFAULT 0,
  arrival_item_id BIGINT REFERENCES arrival_items(id) ON DELETE SET NULL,
  damaged_item_id BIGINT REFERENCES damaged_items(id) ON DELETE SET NULL,
  reason TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  undone_at TIMESTAMPTZ,
  undone_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE follow_ups (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  requested_qty INTEGER NOT NULL DEFAULT 0,
  outstanding_qty INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT 'received_less_items',
  notes TEXT DEFAULT '',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_tracking (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  tracking_number TEXT DEFAULT '',
  measurements TEXT DEFAULT '',
  cbm NUMERIC(12,2) NOT NULL DEFAULT 0,
  moq INTEGER NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, batch_product_id)
);

CREATE TABLE batch_product_shipping (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  fee_per_item NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, batch_product_id)
);

CREATE TABLE shipping_invoices (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  total_expected NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, customer_id)
);

CREATE TABLE shipping_invoice_items (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  shipping_invoice_id BIGINT NOT NULL REFERENCES shipping_invoices(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE RESTRICT,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0,
  fee_per_item NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shipping_batches (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  batch_id BIGINT REFERENCES batches(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL,
  total_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, batch_name)
);

CREATE TABLE shipping_fees (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  batch_id BIGINT REFERENCES batches(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL,
  delivery_id BIGINT,
  client_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  batch_product_id BIGINT REFERENCES batch_products(id) ON DELETE SET NULL,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shipping_payments (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  batch_id BIGINT REFERENCES batches(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL,
  delivery_id BIGINT,
  client_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, batch_name, client_id)
);

CREATE TABLE deliveries (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  shipping_invoice_id BIGINT REFERENCES shipping_invoices(id) ON DELETE SET NULL,
  delivery_type TEXT NOT NULL DEFAULT 'Ghana Post',
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_item_status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT '',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_sales (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT DEFAULT '',
  sale_channel TEXT NOT NULL DEFAULT 'walk_in',
  status TEXT NOT NULL DEFAULT 'closed',
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  closed_at TIMESTAMPTZ,
  closed_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sale_uuid)
);

CREATE TABLE stock_sale_items (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  stock_sale_id BIGINT NOT NULL REFERENCES stock_sales(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE RESTRICT,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL
);

ALTER TABLE stock_sales
  ADD CONSTRAINT stock_sales_status_check
  CHECK (status IN ('open', 'closed', 'cancelled'));

CREATE TABLE expenses (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT DEFAULT '',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id BIGINT,
  entity_uuid UUID,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_shop_memberships_auth_user_id ON shop_memberships(auth_user_id);
CREATE INDEX idx_shop_memberships_shop_id ON shop_memberships(shop_id);
CREATE INDEX idx_roles_shop_id ON roles(shop_id);
CREATE INDEX idx_role_permissions_shop_id ON role_permissions(shop_id);
CREATE INDEX idx_batches_shop_id ON batches(shop_id);
CREATE INDEX idx_products_shop_id ON products(shop_id);
CREATE INDEX idx_batch_products_shop_id ON batch_products(shop_id);
CREATE INDEX idx_customers_shop_id ON customers(shop_id);
CREATE INDEX idx_orders_shop_id ON orders(shop_id);
CREATE INDEX idx_order_items_shop_id ON order_items(shop_id);
CREATE INDEX idx_buying_list_shop_id ON buying_list(shop_id);
CREATE INDEX idx_arrival_items_shop_id ON arrival_items(shop_id);
CREATE INDEX idx_damaged_items_shop_id ON damaged_items(shop_id);
CREATE INDEX idx_damage_order_allocations_shop_id ON damage_order_allocations(shop_id);
CREATE INDEX idx_damage_order_allocations_order_item ON damage_order_allocations(order_item_id);
CREATE INDEX idx_damage_order_allocations_batch ON damage_order_allocations(shop_id, batch_id, product_id, client_id);
CREATE INDEX idx_damage_order_allocations_batch_name ON damage_order_allocations(shop_id, batch_name);
CREATE INDEX idx_follow_ups_shop_id ON follow_ups(shop_id);
CREATE INDEX idx_product_tracking_shop_id ON product_tracking(shop_id);
CREATE INDEX idx_batch_product_shipping_shop_id ON batch_product_shipping(shop_id);
CREATE INDEX idx_shipping_invoices_shop_id ON shipping_invoices(shop_id);
CREATE INDEX idx_shipping_invoice_items_shop_id ON shipping_invoice_items(shop_id);
CREATE INDEX idx_shipping_batches_shop_id ON shipping_batches(shop_id);
CREATE INDEX idx_shipping_batches_batch_id ON shipping_batches(shop_id, batch_id);
CREATE INDEX idx_shipping_fees_shop_id ON shipping_fees(shop_id);
CREATE INDEX idx_shipping_payments_shop_id ON shipping_payments(shop_id);
CREATE INDEX idx_deliveries_shop_id ON deliveries(shop_id);
CREATE INDEX idx_stock_sales_shop_id ON stock_sales(shop_id);
CREATE INDEX idx_stock_sales_shop_status_created ON stock_sales(shop_id, status, created_at DESC);
CREATE INDEX idx_stock_sale_items_shop_id ON stock_sale_items(shop_id);
CREATE INDEX idx_expenses_shop_id ON expenses(shop_id);
CREATE INDEX idx_audit_log_shop_id ON audit_log(shop_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_table, entity_id);

-- ============================================================
-- TRIGGERS: updated_at, actor fields, auditing
-- ============================================================

CREATE TRIGGER trg_shops_updated BEFORE UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_app_users_updated BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_roles_updated BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_role_permissions_updated BEFORE UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_shop_memberships_updated BEFORE UPDATE ON shop_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_batches_updated BEFORE UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_batch_products_updated BEFORE UPDATE ON batch_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_order_items_updated BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_buying_list_updated BEFORE UPDATE ON buying_list
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_arrival_items_updated BEFORE UPDATE ON arrival_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_damaged_items_updated BEFORE UPDATE ON damaged_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_damage_order_allocations_updated BEFORE UPDATE ON damage_order_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_follow_ups_updated BEFORE UPDATE ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_product_tracking_updated BEFORE UPDATE ON product_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_batch_product_shipping_updated BEFORE UPDATE ON batch_product_shipping
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_shipping_invoices_updated BEFORE UPDATE ON shipping_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_shipping_invoice_items_updated BEFORE UPDATE ON shipping_invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_shipping_batches_updated BEFORE UPDATE ON shipping_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_shipping_fees_updated BEFORE UPDATE ON shipping_fees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_shipping_payments_updated BEFORE UPDATE ON shipping_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_deliveries_updated BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_stock_sales_updated BEFORE UPDATE ON stock_sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_shops_actor BEFORE INSERT OR UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_app_users_actor BEFORE INSERT OR UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_roles_actor BEFORE INSERT OR UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_role_permissions_actor BEFORE INSERT OR UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_shop_memberships_actor BEFORE INSERT OR UPDATE ON shop_memberships
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_sync_user_active_shop
  AFTER INSERT OR UPDATE OF is_active, shop_id ON shop_memberships
  FOR EACH ROW EXECUTE FUNCTION sync_user_active_shop();

CREATE TRIGGER trg_batches_shop BEFORE INSERT OR UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_batches_actor BEFORE INSERT OR UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_products_shop BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_products_actor BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_batch_products_shop BEFORE INSERT OR UPDATE ON batch_products
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_batch_products_actor BEFORE INSERT OR UPDATE ON batch_products
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_customers_shop BEFORE INSERT OR UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_customers_actor BEFORE INSERT OR UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_orders_shop BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_orders_actor BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_order_items_shop BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_order_items_actor BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_buying_list_shop BEFORE INSERT OR UPDATE ON buying_list
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_buying_list_actor BEFORE INSERT OR UPDATE ON buying_list
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_arrival_items_shop BEFORE INSERT OR UPDATE ON arrival_items
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_arrival_items_actor BEFORE INSERT OR UPDATE ON arrival_items
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_damaged_items_shop BEFORE INSERT OR UPDATE ON damaged_items
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_damaged_items_actor BEFORE INSERT OR UPDATE ON damaged_items
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_damage_order_allocations_shop BEFORE INSERT OR UPDATE ON damage_order_allocations
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_damage_order_allocations_actor BEFORE INSERT OR UPDATE ON damage_order_allocations
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_follow_ups_shop BEFORE INSERT OR UPDATE ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_follow_ups_actor BEFORE INSERT OR UPDATE ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_product_tracking_shop BEFORE INSERT OR UPDATE ON product_tracking
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_product_tracking_actor BEFORE INSERT OR UPDATE ON product_tracking
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_batch_product_shipping_shop BEFORE INSERT OR UPDATE ON batch_product_shipping
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_batch_product_shipping_actor BEFORE INSERT OR UPDATE ON batch_product_shipping
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_shipping_invoices_shop BEFORE INSERT OR UPDATE ON shipping_invoices
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_shipping_invoices_actor BEFORE INSERT OR UPDATE ON shipping_invoices
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_shipping_invoice_items_shop BEFORE INSERT OR UPDATE ON shipping_invoice_items
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_shipping_invoice_items_actor BEFORE INSERT OR UPDATE ON shipping_invoice_items
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_shipping_batches_shop BEFORE INSERT OR UPDATE ON shipping_batches
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_shipping_batches_actor BEFORE INSERT OR UPDATE ON shipping_batches
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_shipping_fees_shop BEFORE INSERT OR UPDATE ON shipping_fees
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_shipping_fees_actor BEFORE INSERT OR UPDATE ON shipping_fees
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_shipping_payments_shop BEFORE INSERT OR UPDATE ON shipping_payments
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_shipping_payments_actor BEFORE INSERT OR UPDATE ON shipping_payments
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_deliveries_shop BEFORE INSERT OR UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_deliveries_actor BEFORE INSERT OR UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_stock_sales_shop BEFORE INSERT OR UPDATE ON stock_sales
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_stock_sales_actor BEFORE INSERT OR UPDATE ON stock_sales
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_stock_sale_items_shop BEFORE INSERT OR UPDATE ON stock_sale_items
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_stock_sale_items_actor BEFORE INSERT OR UPDATE ON stock_sale_items
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_expenses_shop BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();
CREATE TRIGGER trg_expenses_actor BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_audit_log_shop BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();

CREATE TRIGGER trg_roles_audit
  AFTER INSERT OR UPDATE OR DELETE ON roles
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_role_permissions_audit
  AFTER INSERT OR UPDATE OR DELETE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_app_users_audit
  AFTER INSERT OR UPDATE OR DELETE ON app_users
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_batches_audit
  AFTER INSERT OR UPDATE OR DELETE ON batches
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_products_audit
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_batch_products_audit
  AFTER INSERT OR UPDATE OR DELETE ON batch_products
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_customers_audit
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_orders_audit
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_order_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_buying_list_audit
  AFTER INSERT OR UPDATE OR DELETE ON buying_list
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_arrival_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON arrival_items
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_damaged_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON damaged_items
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_follow_ups_audit
  AFTER INSERT OR UPDATE OR DELETE ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_product_tracking_audit
  AFTER INSERT OR UPDATE OR DELETE ON product_tracking
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_batch_product_shipping_audit
  AFTER INSERT OR UPDATE OR DELETE ON batch_product_shipping
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_shipping_invoices_audit
  AFTER INSERT OR UPDATE OR DELETE ON shipping_invoices
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_shipping_invoice_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON shipping_invoice_items
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_shipping_batches_audit
  AFTER INSERT OR UPDATE OR DELETE ON shipping_batches
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_shipping_fees_audit
  AFTER INSERT OR UPDATE OR DELETE ON shipping_fees
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_shipping_payments_audit
  AFTER INSERT OR UPDATE OR DELETE ON shipping_payments
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_deliveries_audit
  AFTER INSERT OR UPDATE OR DELETE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_stock_sales_audit
  AFTER INSERT OR UPDATE OR DELETE ON stock_sales
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_stock_sale_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON stock_sale_items
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_expenses_audit
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

-- ============================================================
-- HELPER FUNCTIONS (DEPENDS ON TABLES)
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS (DEPENDS ON TABLES)
-- ============================================================

CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  app_user_id BIGINT;
BEGIN
  SELECT id INTO app_user_id
  FROM public.app_users
  WHERE auth_id = auth.uid();

  RETURN app_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION has_shop_membership(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT (
    (auth.jwt() -> 'user_metadata' ->> 'shop_id') = p_shop_id::text
    OR
    EXISTS (
      SELECT 1
      FROM public.shop_memberships sm
      WHERE sm.shop_id = p_shop_id
        AND sm.auth_user_id = auth.uid()
        AND sm.is_active = TRUE
    )
  );
$$;

CREATE OR REPLACE FUNCTION can_access_app_user(p_app_user_id BIGINT)
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

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE buying_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE arrival_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE damaged_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_order_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_product_shipping ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read shops"
  ON shops
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM shop_memberships sm
    WHERE sm.shop_id = shops.id
      AND sm.auth_user_id = auth.uid()
      AND sm.is_active = TRUE
  ));

CREATE POLICY "Authenticated can insert shops"
  ON shops
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Authenticated can read own app user"
  ON app_users
  FOR SELECT TO authenticated
  USING (
    auth_id = auth.uid()
    OR can_access_app_user(id)
  );

CREATE POLICY "Authenticated can insert app users"
  ON app_users
  FOR INSERT TO authenticated
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "Authenticated can update own app user"
  ON app_users
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid() OR can_access_app_user(id))
  WITH CHECK (auth_id = auth.uid() OR can_access_app_user(id));

CREATE POLICY "Authenticated can read roles"
  ON roles
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write roles"
  ON roles
  FOR INSERT TO authenticated
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can update roles"
  ON roles
  FOR UPDATE TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read role_permissions"
  ON role_permissions
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write role_permissions"
  ON role_permissions
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read memberships"
  ON shop_memberships
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can insert memberships"
  ON shop_memberships
  FOR INSERT TO authenticated
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can update memberships"
  ON shop_memberships
  FOR UPDATE TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can delete memberships"
  ON shop_memberships
  FOR DELETE TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read batches"
  ON batches
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write batches"
  ON batches
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read products"
  ON products
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write products"
  ON products
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read batch_products"
  ON batch_products
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write batch_products"
  ON batch_products
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read customers"
  ON customers
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write customers"
  ON customers
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read orders"
  ON orders
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write orders"
  ON orders
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read order_items"
  ON order_items
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write order_items"
  ON order_items
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read buying_list"
  ON buying_list
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write buying_list"
  ON buying_list
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read arrival_items"
  ON arrival_items
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write arrival_items"
  ON arrival_items
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read damaged_items"
  ON damaged_items
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write damaged_items"
  ON damaged_items
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read damage_order_allocations"
  ON damage_order_allocations
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write damage_order_allocations"
  ON damage_order_allocations
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read follow_ups"
  ON follow_ups
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write follow_ups"
  ON follow_ups
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read product_tracking"
  ON product_tracking
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write product_tracking"
  ON product_tracking
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read batch_product_shipping"
  ON batch_product_shipping
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write batch_product_shipping"
  ON batch_product_shipping
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read shipping_invoices"
  ON shipping_invoices
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write shipping_invoices"
  ON shipping_invoices
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read shipping_invoice_items"
  ON shipping_invoice_items
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write shipping_invoice_items"
  ON shipping_invoice_items
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read shipping_batches"
  ON shipping_batches
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write shipping_batches"
  ON shipping_batches
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read shipping_fees"
  ON shipping_fees
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write shipping_fees"
  ON shipping_fees
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read shipping_payments"
  ON shipping_payments
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write shipping_payments"
  ON shipping_payments
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read deliveries"
  ON deliveries
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write deliveries"
  ON deliveries
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read stock_sales"
  ON stock_sales
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write stock_sales"
  ON stock_sales
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read stock_sale_items"
  ON stock_sale_items
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write stock_sale_items"
  ON stock_sale_items
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read expenses"
  ON expenses
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write expenses"
  ON expenses
  FOR ALL TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can read audit_log"
  ON audit_log
  FOR SELECT TO authenticated
  USING (has_shop_membership(shop_id));

CREATE POLICY "Authenticated can insert audit_log"
  ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (has_shop_membership(shop_id));

-- ============================================================
-- END OF SCHEMA
-- ============================================================
