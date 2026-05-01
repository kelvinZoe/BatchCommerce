-- ============================================================
-- Shakhis Commerce – Workflow Migration (Full Reset)
-- This migration drops existing public tables and recreates
-- the schema based on the new workflow.
-- ============================================================

-- Enable UUID generator
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables (test environment reset)
DROP TABLE IF EXISTS stock_sale_items CASCADE;
DROP TABLE IF EXISTS stock_sales CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
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
DROP TABLE IF EXISTS app_users CASCADE;

-- ============================================================
-- 1) AUTH / RBAC
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  can_view BOOLEAN DEFAULT FALSE,
  can_add BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  can_close_batch BOOLEAN DEFAULT FALSE,
  UNIQUE(role_id, resource)
);

CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  role_id BIGINT NOT NULL REFERENCES roles(id),
  is_active BOOLEAN DEFAULT TRUE,
  email TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add user trails to roles and role_permissions now that app_users exists
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL;

ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL;

-- ============================================================
-- 2) CORE BATCH / PRODUCT CATALOG
-- ============================================================

CREATE TABLE IF NOT EXISTS batches (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open',
  order_status TEXT NOT NULL DEFAULT 'pending',
  buying_status TEXT NOT NULL DEFAULT 'pending',
  delivery_status TEXT NOT NULL DEFAULT 'not_sent',
  arrivals_sent BOOLEAN DEFAULT FALSE,
  stock_applied BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name)
);

-- Batch-specific pricing, discounts, and stock
CREATE TABLE IF NOT EXISTS batch_products (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  preorder_price NUMERIC NOT NULL DEFAULT 0,
  preorder_discount_min_qty INTEGER DEFAULT 0,
  preorder_discount_price NUMERIC DEFAULT 0,
  stock_price NUMERIC NOT NULL DEFAULT 0,
  stock_discount_min_qty INTEGER DEFAULT 0,
  stock_discount_price NUMERIC DEFAULT 0,
  in_stock_qty INTEGER NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, product_id)
);

-- ============================================================
-- 3) CUSTOMERS AND ORDERS (PAID BY DEFAULT)
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  address TEXT DEFAULT '',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  notes TEXT DEFAULT '',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_uuid)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE RESTRICT,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_applied BOOLEAN DEFAULT FALSE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL
);

-- ============================================================
-- 4) BUYING LIST (AGGREGATED PER BATCH PRODUCT)
-- ============================================================

CREATE TABLE IF NOT EXISTS buying_list (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  requested_qty INTEGER NOT NULL DEFAULT 0,
  ordered_qty INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  moved_to_arrivals BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, batch_product_id)
);

-- ============================================================
-- 5) ARRIVALS, DAMAGES, FOLLOW-UPS
-- ============================================================

CREATE TABLE IF NOT EXISTS arrival_items (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  requested_qty INTEGER NOT NULL DEFAULT 0,
  received_qty INTEGER NOT NULL DEFAULT 0,
  confirmed_qty INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, batch_product_id)
);

CREATE TABLE IF NOT EXISTS damaged_items (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  requested_qty INTEGER NOT NULL DEFAULT 0,
  damaged_qty INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT 'damaged_in_transit',
  notes TEXT DEFAULT '',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  requested_qty INTEGER NOT NULL DEFAULT 0,
  outstanding_qty INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT 'received_less_items',
  notes TEXT DEFAULT '',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6) PRODUCT TRACKING DETAILS
-- ============================================================

CREATE TABLE IF NOT EXISTS product_tracking (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  tracking_number TEXT DEFAULT '',
  measurements TEXT DEFAULT '',
  cbm NUMERIC DEFAULT 0,
  moq INTEGER DEFAULT 0,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, batch_product_id)
);

-- ============================================================
-- 7) SHIPPING (PRODUCT FEES + CUSTOMER LEDGER)
-- ============================================================

CREATE TABLE IF NOT EXISTS batch_product_shipping (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  fee_per_item NUMERIC NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, batch_product_id)
);

CREATE TABLE IF NOT EXISTS shipping_invoices (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  total_expected NUMERIC NOT NULL DEFAULT 0,
  total_paid NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, customer_id)
);

CREATE TABLE IF NOT EXISTS shipping_invoice_items (
  id BIGSERIAL PRIMARY KEY,
  shipping_invoice_id BIGINT NOT NULL REFERENCES shipping_invoices(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE RESTRICT,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0,
  fee_per_item NUMERIC NOT NULL DEFAULT 0,
  total_fee NUMERIC NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL
);

-- ============================================================
-- 8) DELIVERIES
-- ============================================================

CREATE TABLE IF NOT EXISTS deliveries (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  shipping_invoice_id BIGINT REFERENCES shipping_invoices(id) ON DELETE SET NULL,
  delivery_type TEXT NOT NULL DEFAULT 'Ghana Post',
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT '',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9) IN-STOCK SALES (WALK-IN / ONLINE)
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_sales (
  id BIGSERIAL PRIMARY KEY,
  sale_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT DEFAULT '',
  sale_channel TEXT NOT NULL DEFAULT 'walk_in',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sale_uuid)
);

CREATE TABLE IF NOT EXISTS stock_sale_items (
  id BIGSERIAL PRIMARY KEY,
  stock_sale_id BIGINT NOT NULL REFERENCES stock_sales(id) ON DELETE CASCADE,
  batch_product_id BIGINT NOT NULL REFERENCES batch_products(id) ON DELETE RESTRICT,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL
);

-- ============================================================
-- 9.5) AUDIT LOG (USER ACTION TRAILS)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id BIGINT,
  entity_uuid UUID,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10) INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_batch_products_batch ON batch_products(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_products_product ON batch_products(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_batch ON orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_buying_list_batch ON buying_list(batch_id);
CREATE INDEX IF NOT EXISTS idx_arrival_items_batch ON arrival_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_shipping_invoices_customer ON shipping_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_batch ON deliveries(batch_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_table, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- ============================================================
-- 11) AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS BIGINT AS $$
DECLARE
  app_user_id BIGINT;
BEGIN
  SELECT id INTO app_user_id
  FROM app_users
  WHERE auth_id = auth.uid();

  RETURN app_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION audit_log_write()
RETURNS TRIGGER AS $$
DECLARE
  actor_id BIGINT;
  entity_uuid_val UUID;
BEGIN
  actor_id := current_app_user_id();

  IF TG_OP = 'INSERT' THEN
    entity_uuid_val := COALESCE(
      NULLIF(to_jsonb(NEW)->>'order_uuid', '')::uuid,
      NULLIF(to_jsonb(NEW)->>'sale_uuid', '')::uuid
    );

    INSERT INTO audit_log (
      actor_user_id,
      action,
      entity_table,
      entity_id,
      entity_uuid,
      before_data,
      after_data
    ) VALUES (
      actor_id,
      'insert',
      TG_TABLE_NAME,
      NEW.id,
      entity_uuid_val,
      NULL,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    entity_uuid_val := COALESCE(
      NULLIF(to_jsonb(NEW)->>'order_uuid', '')::uuid,
      NULLIF(to_jsonb(NEW)->>'sale_uuid', '')::uuid
    );
    INSERT INTO audit_log (
      actor_user_id,
      action,
      entity_table,
      entity_id,
      entity_uuid,
      before_data,
      after_data
    ) VALUES (
      actor_id,
      'update',
      TG_TABLE_NAME,
      NEW.id,
      entity_uuid_val,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    entity_uuid_val := COALESCE(
      NULLIF(to_jsonb(OLD)->>'order_uuid', '')::uuid,
      NULLIF(to_jsonb(OLD)->>'sale_uuid', '')::uuid
    );
    INSERT INTO audit_log (
      actor_user_id,
      action,
      entity_table,
      entity_id,
      entity_uuid,
      before_data,
      after_data
    ) VALUES (
      actor_id,
      'delete',
      TG_TABLE_NAME,
      OLD.id,
      entity_uuid_val,
      to_jsonb(OLD),
      NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_actor_fields()
RETURNS TRIGGER AS $$
DECLARE
  actor_id BIGINT;
BEGIN
  actor_id := current_app_user_id();

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := actor_id;
    END IF;
    IF NEW.updated_by IS NULL THEN
      NEW.updated_by := actor_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.updated_by IS NULL THEN
      NEW.updated_by := actor_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_roles_updated BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_app_users_updated BEFORE UPDATE ON app_users
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

CREATE TRIGGER trg_buying_list_updated BEFORE UPDATE ON buying_list
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_arrival_items_updated BEFORE UPDATE ON arrival_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_product_tracking_updated BEFORE UPDATE ON product_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_batch_product_shipping_updated BEFORE UPDATE ON batch_product_shipping
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_shipping_invoices_updated BEFORE UPDATE ON shipping_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_deliveries_updated BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_stock_sales_updated BEFORE UPDATE ON stock_sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 11.5) ACTOR AUTO-FILL TRIGGERS
-- ============================================================

CREATE TRIGGER trg_roles_actor
  BEFORE INSERT OR UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_role_permissions_actor
  BEFORE INSERT OR UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_app_users_actor
  BEFORE INSERT OR UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_batches_actor
  BEFORE INSERT OR UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_products_actor
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_batch_products_actor
  BEFORE INSERT OR UPDATE ON batch_products
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_customers_actor
  BEFORE INSERT OR UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_orders_actor
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_order_items_actor
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_buying_list_actor
  BEFORE INSERT OR UPDATE ON buying_list
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_arrival_items_actor
  BEFORE INSERT OR UPDATE ON arrival_items
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_damaged_items_actor
  BEFORE INSERT OR UPDATE ON damaged_items
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_follow_ups_actor
  BEFORE INSERT OR UPDATE ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_product_tracking_actor
  BEFORE INSERT OR UPDATE ON product_tracking
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_batch_product_shipping_actor
  BEFORE INSERT OR UPDATE ON batch_product_shipping
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_shipping_invoices_actor
  BEFORE INSERT OR UPDATE ON shipping_invoices
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_shipping_invoice_items_actor
  BEFORE INSERT OR UPDATE ON shipping_invoice_items
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_deliveries_actor
  BEFORE INSERT OR UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_stock_sales_actor
  BEFORE INSERT OR UPDATE ON stock_sales
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

CREATE TRIGGER trg_stock_sale_items_actor
  BEFORE INSERT OR UPDATE ON stock_sale_items
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

-- ============================================================
-- 11.8) SEED ROLES, PERMISSIONS, ADMIN USER
-- ============================================================

INSERT INTO roles (name, description, is_system)
VALUES
  ('Admin', 'Full access to all features', TRUE),
  ('Manager', 'Manage daily operations', TRUE),
  ('Staff', 'Limited operational access', TRUE)
ON CONFLICT (name) DO NOTHING;

WITH role_ids AS (
  SELECT id, name FROM roles WHERE name IN ('Admin', 'Manager', 'Staff')
), resources AS (
  SELECT unnest(ARRAY[
    'dashboard','arrivals','reports','products','clients','orders','deliveries',
    'buying_list','damaged_items','expenses','import','users','roles','settings','shipping'
  ]) AS resource
)
INSERT INTO role_permissions (role_id, resource, can_view, can_add, can_edit, can_delete, can_close_batch)
SELECT r.id, res.resource,
  CASE WHEN r.name IN ('Admin','Manager','Staff') THEN TRUE ELSE FALSE END,
  CASE WHEN r.name IN ('Admin','Manager') THEN TRUE ELSE FALSE END,
  CASE WHEN r.name IN ('Admin','Manager') THEN TRUE ELSE FALSE END,
  CASE WHEN r.name = 'Admin' THEN TRUE ELSE FALSE END,
  CASE WHEN r.name IN ('Admin','Manager') THEN TRUE ELSE FALSE END
FROM role_ids r
CROSS JOIN resources res
ON CONFLICT (role_id, resource) DO NOTHING;

INSERT INTO app_users (username, full_name, phone, role_id, is_active, email)
SELECT 'admin', 'Admin', '', r.id, TRUE, 'admin@shakhis.com'
FROM roles r
WHERE r.name = 'Admin'
  AND NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'admin');

CREATE OR REPLACE FUNCTION link_admin_auth(p_auth_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE app_users
  SET auth_id = p_auth_id
  WHERE username = 'admin' AND auth_id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 12) AUDIT LOG TRIGGERS
-- ============================================================

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

CREATE TRIGGER trg_deliveries_audit
  AFTER INSERT OR UPDATE OR DELETE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_stock_sales_audit
  AFTER INSERT OR UPDATE OR DELETE ON stock_sales
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

CREATE TRIGGER trg_stock_sale_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON stock_sale_items
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();

-- ============================================================
-- 13) RLS POLICIES
-- ============================================================

-- Drop existing policies to keep re-runs idempotent
DROP POLICY IF EXISTS "Authenticated can read roles" ON roles;
DROP POLICY IF EXISTS "Authenticated can insert roles" ON roles;
DROP POLICY IF EXISTS "Authenticated can update roles" ON roles;

DROP POLICY IF EXISTS "Authenticated can read role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Authenticated can insert role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Authenticated can update role_permissions" ON role_permissions;

DROP POLICY IF EXISTS "Authenticated can read app_users" ON app_users;
DROP POLICY IF EXISTS "Authenticated can insert app_users" ON app_users;
DROP POLICY IF EXISTS "Authenticated can update app_users" ON app_users;

DROP POLICY IF EXISTS "Authenticated can read batches" ON batches;
DROP POLICY IF EXISTS "Authenticated can insert batches" ON batches;
DROP POLICY IF EXISTS "Authenticated can update batches" ON batches;

DROP POLICY IF EXISTS "Authenticated can read products" ON products;
DROP POLICY IF EXISTS "Authenticated can insert products" ON products;
DROP POLICY IF EXISTS "Authenticated can update products" ON products;

DROP POLICY IF EXISTS "Authenticated can read batch_products" ON batch_products;
DROP POLICY IF EXISTS "Authenticated can insert batch_products" ON batch_products;
DROP POLICY IF EXISTS "Authenticated can update batch_products" ON batch_products;

DROP POLICY IF EXISTS "Authenticated can read customers" ON customers;
DROP POLICY IF EXISTS "Authenticated can insert customers" ON customers;
DROP POLICY IF EXISTS "Authenticated can update customers" ON customers;

DROP POLICY IF EXISTS "Authenticated can read orders" ON orders;
DROP POLICY IF EXISTS "Authenticated can insert orders" ON orders;
DROP POLICY IF EXISTS "Authenticated can update orders" ON orders;

DROP POLICY IF EXISTS "Authenticated can read order_items" ON order_items;
DROP POLICY IF EXISTS "Authenticated can insert order_items" ON order_items;
DROP POLICY IF EXISTS "Authenticated can update order_items" ON order_items;

DROP POLICY IF EXISTS "Authenticated can read buying_list" ON buying_list;
DROP POLICY IF EXISTS "Authenticated can insert buying_list" ON buying_list;
DROP POLICY IF EXISTS "Authenticated can update buying_list" ON buying_list;

DROP POLICY IF EXISTS "Authenticated can read arrival_items" ON arrival_items;
DROP POLICY IF EXISTS "Authenticated can insert arrival_items" ON arrival_items;
DROP POLICY IF EXISTS "Authenticated can update arrival_items" ON arrival_items;

DROP POLICY IF EXISTS "Authenticated can read damaged_items" ON damaged_items;
DROP POLICY IF EXISTS "Authenticated can insert damaged_items" ON damaged_items;

DROP POLICY IF EXISTS "Authenticated can read follow_ups" ON follow_ups;
DROP POLICY IF EXISTS "Authenticated can insert follow_ups" ON follow_ups;

DROP POLICY IF EXISTS "Authenticated can read product_tracking" ON product_tracking;
DROP POLICY IF EXISTS "Authenticated can insert product_tracking" ON product_tracking;
DROP POLICY IF EXISTS "Authenticated can update product_tracking" ON product_tracking;

DROP POLICY IF EXISTS "Authenticated can read batch_product_shipping" ON batch_product_shipping;
DROP POLICY IF EXISTS "Authenticated can insert batch_product_shipping" ON batch_product_shipping;
DROP POLICY IF EXISTS "Authenticated can update batch_product_shipping" ON batch_product_shipping;

DROP POLICY IF EXISTS "Authenticated can read shipping_invoices" ON shipping_invoices;
DROP POLICY IF EXISTS "Authenticated can insert shipping_invoices" ON shipping_invoices;
DROP POLICY IF EXISTS "Authenticated can update shipping_invoices" ON shipping_invoices;

DROP POLICY IF EXISTS "Authenticated can read shipping_invoice_items" ON shipping_invoice_items;
DROP POLICY IF EXISTS "Authenticated can insert shipping_invoice_items" ON shipping_invoice_items;
DROP POLICY IF EXISTS "Authenticated can update shipping_invoice_items" ON shipping_invoice_items;

DROP POLICY IF EXISTS "Authenticated can read deliveries" ON deliveries;
DROP POLICY IF EXISTS "Authenticated can insert deliveries" ON deliveries;
DROP POLICY IF EXISTS "Authenticated can update deliveries" ON deliveries;

DROP POLICY IF EXISTS "Authenticated can read stock_sales" ON stock_sales;
DROP POLICY IF EXISTS "Authenticated can insert stock_sales" ON stock_sales;
DROP POLICY IF EXISTS "Authenticated can update stock_sales" ON stock_sales;

DROP POLICY IF EXISTS "Authenticated can read stock_sale_items" ON stock_sale_items;
DROP POLICY IF EXISTS "Authenticated can insert stock_sale_items" ON stock_sale_items;
DROP POLICY IF EXISTS "Authenticated can update stock_sale_items" ON stock_sale_items;

DROP POLICY IF EXISTS "Authenticated can read audit_log" ON audit_log;
DROP POLICY IF EXISTS "Authenticated can insert audit_log" ON audit_log;

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE buying_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE arrival_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE damaged_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_product_shipping ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read roles" ON roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert roles" ON roles
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update roles" ON roles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read role_permissions" ON role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert role_permissions" ON role_permissions
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update role_permissions" ON role_permissions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read app_users" ON app_users
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert app_users" ON app_users
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update app_users" ON app_users
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read batches" ON batches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert batches" ON batches
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update batches" ON batches
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read products" ON products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert products" ON products
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update products" ON products
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read batch_products" ON batch_products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert batch_products" ON batch_products
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update batch_products" ON batch_products
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read customers" ON customers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert customers" ON customers
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update customers" ON customers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read orders" ON orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert orders" ON orders
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update orders" ON orders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read order_items" ON order_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert order_items" ON order_items
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update order_items" ON order_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read buying_list" ON buying_list
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert buying_list" ON buying_list
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update buying_list" ON buying_list
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read arrival_items" ON arrival_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert arrival_items" ON arrival_items
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update arrival_items" ON arrival_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read damaged_items" ON damaged_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert damaged_items" ON damaged_items
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());

CREATE POLICY "Authenticated can read follow_ups" ON follow_ups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert follow_ups" ON follow_ups
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());

CREATE POLICY "Authenticated can read product_tracking" ON product_tracking
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert product_tracking" ON product_tracking
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update product_tracking" ON product_tracking
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read batch_product_shipping" ON batch_product_shipping
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert batch_product_shipping" ON batch_product_shipping
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update batch_product_shipping" ON batch_product_shipping
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read shipping_invoices" ON shipping_invoices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert shipping_invoices" ON shipping_invoices
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update shipping_invoices" ON shipping_invoices
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read shipping_invoice_items" ON shipping_invoice_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert shipping_invoice_items" ON shipping_invoice_items
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update shipping_invoice_items" ON shipping_invoice_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read deliveries" ON deliveries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert deliveries" ON deliveries
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update deliveries" ON deliveries
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read stock_sales" ON stock_sales
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert stock_sales" ON stock_sales
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update stock_sales" ON stock_sales
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read stock_sale_items" ON stock_sale_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert stock_sale_items" ON stock_sale_items
  FOR INSERT TO authenticated WITH CHECK (created_by = current_app_user_id());
CREATE POLICY "Authenticated can update stock_sale_items" ON stock_sale_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = current_app_user_id());

CREATE POLICY "Authenticated can read audit_log" ON audit_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert audit_log" ON audit_log
  FOR INSERT TO authenticated WITH CHECK (true);
