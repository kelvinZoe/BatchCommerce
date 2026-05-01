-- ============================================================
-- Shakhis Commerce – Supabase Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- ╔═══════════════════════════════════════╗
-- ║  1. TABLES                            ║
-- ╚═══════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  preorder_price NUMERIC,
  local_price NUMERIC,
  shipping_fee NUMERIC,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  in_stock BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_number TEXT,
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  total_amount NUMERIC DEFAULT 0,
  delivery_fee NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'unpaid',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS deliveries (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  items TEXT,
  quantity INTEGER DEFAULT 1,
  delivery_fee NUMERIC DEFAULT 0,
  delivery_address TEXT DEFAULT '',
  delivery_date DATE,
  status TEXT DEFAULT 'pending',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buying_list (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  requested_quantity INTEGER DEFAULT 0,
  quantity_arrived INTEGER DEFAULT 0,
  batch_name TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Auth / RBAC tables ────────────────────────────────

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
  can_create BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  UNIQUE(role_id, resource)
);

-- App-level users table (linked to Supabase auth.users via auth_id)
CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  role_id BIGINT NOT NULL REFERENCES roles(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ╔═══════════════════════════════════════╗
-- ║  2. INDEXES                           ║
-- ╚═══════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_client_id ON deliveries(client_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_buying_list_batch ON buying_list(batch_name);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role_id);
CREATE INDEX IF NOT EXISTS idx_app_users_auth ON app_users(auth_id);

-- ╔═══════════════════════════════════════╗
-- ║  3. AUTO-UPDATE updated_at TRIGGER    ║
-- ╚═══════════════════════════════════════╝

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_buying_list_updated BEFORE UPDATE ON buying_list
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_app_users_updated BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ╔═══════════════════════════════════════╗
-- ║  4. ROW LEVEL SECURITY                ║
-- ╚═══════════════════════════════════════╝

-- Enable RLS on all tables
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE buying_list    ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users      ENABLE ROW LEVEL SECURITY;

-- For now: any authenticated user can read/write all business data.
-- Fine-grained RBAC is enforced in the Angular app layer.
-- You can tighten these later as needed.

CREATE POLICY "Authenticated users can read all data" ON products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert products" ON products
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products" ON products
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete products" ON products
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read clients" ON clients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON clients
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON clients
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete clients" ON clients
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read orders" ON orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert orders" ON orders
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update orders" ON orders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete orders" ON orders
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read order_items" ON order_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert order_items" ON order_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update order_items" ON order_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete order_items" ON order_items
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read deliveries" ON deliveries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert deliveries" ON deliveries
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update deliveries" ON deliveries
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete deliveries" ON deliveries
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read buying_list" ON buying_list
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert buying_list" ON buying_list
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update buying_list" ON buying_list
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete buying_list" ON buying_list
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read roles" ON roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert roles" ON roles
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update roles" ON roles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete roles" ON roles
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read role_permissions" ON role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert role_permissions" ON role_permissions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update role_permissions" ON role_permissions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete role_permissions" ON role_permissions
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read app_users" ON app_users
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert app_users" ON app_users
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update app_users" ON app_users
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete app_users" ON app_users
  FOR DELETE TO authenticated USING (true);

-- ╔═══════════════════════════════════════╗
-- ║  5. SEED DEFAULT ROLES                ║
-- ╚═══════════════════════════════════════╝

-- Admin role (full access)
INSERT INTO roles (name, description, is_system)
VALUES ('Admin', 'Full system access', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (name, description, is_system)
VALUES ('Sales', 'Sales team member', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (name, description, is_system)
VALUES ('Delivery', 'Delivery personnel', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (name, description, is_system)
VALUES ('Accountant', 'Financial oversight', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Admin permissions (all resources, full access)
DO $$
DECLARE
  admin_id BIGINT;
  res TEXT;
BEGIN
  SELECT id INTO admin_id FROM roles WHERE name = 'Admin';
  FOREACH res IN ARRAY ARRAY['dashboard','products','clients','orders','deliveries','buying_list','import','users','roles','settings']
  LOOP
    INSERT INTO role_permissions (role_id, resource, can_view, can_create, can_edit, can_delete)
    VALUES (admin_id, res, TRUE, TRUE, TRUE, TRUE)
    ON CONFLICT (role_id, resource) DO NOTHING;
  END LOOP;
END $$;

-- Sales permissions
DO $$
DECLARE
  role BIGINT;
BEGIN
  SELECT id INTO role FROM roles WHERE name = 'Sales';
  INSERT INTO role_permissions (role_id, resource, can_view, can_create, can_edit, can_delete) VALUES
    (role, 'dashboard',   TRUE,  FALSE, FALSE, FALSE),
    (role, 'products',    TRUE,  FALSE, FALSE, FALSE),
    (role, 'clients',     TRUE,  TRUE,  TRUE,  FALSE),
    (role, 'orders',      TRUE,  TRUE,  TRUE,  FALSE),
    (role, 'deliveries',  TRUE,  FALSE, FALSE, FALSE),
    (role, 'buying_list', TRUE,  FALSE, FALSE, FALSE),
    (role, 'import',      FALSE, FALSE, FALSE, FALSE),
    (role, 'users',       FALSE, FALSE, FALSE, FALSE),
    (role, 'roles',       FALSE, FALSE, FALSE, FALSE),
    (role, 'settings',    FALSE, FALSE, FALSE, FALSE)
  ON CONFLICT (role_id, resource) DO NOTHING;
END $$;

-- Delivery permissions
DO $$
DECLARE
  role BIGINT;
BEGIN
  SELECT id INTO role FROM roles WHERE name = 'Delivery';
  INSERT INTO role_permissions (role_id, resource, can_view, can_create, can_edit, can_delete) VALUES
    (role, 'dashboard',   TRUE,  FALSE, FALSE, FALSE),
    (role, 'products',    TRUE,  FALSE, FALSE, FALSE),
    (role, 'clients',     TRUE,  FALSE, FALSE, FALSE),
    (role, 'orders',      TRUE,  FALSE, TRUE,  FALSE),
    (role, 'deliveries',  TRUE,  TRUE,  TRUE,  FALSE),
    (role, 'buying_list', FALSE, FALSE, FALSE, FALSE),
    (role, 'import',      FALSE, FALSE, FALSE, FALSE),
    (role, 'users',       FALSE, FALSE, FALSE, FALSE),
    (role, 'roles',       FALSE, FALSE, FALSE, FALSE),
    (role, 'settings',    FALSE, FALSE, FALSE, FALSE)
  ON CONFLICT (role_id, resource) DO NOTHING;
END $$;

-- Accountant permissions
DO $$
DECLARE
  role BIGINT;
BEGIN
  SELECT id INTO role FROM roles WHERE name = 'Accountant';
  INSERT INTO role_permissions (role_id, resource, can_view, can_create, can_edit, can_delete) VALUES
    (role, 'dashboard',   TRUE,  FALSE, FALSE, FALSE),
    (role, 'products',    TRUE,  FALSE, FALSE, FALSE),
    (role, 'clients',     TRUE,  FALSE, FALSE, FALSE),
    (role, 'orders',      TRUE,  FALSE, TRUE,  FALSE),
    (role, 'deliveries',  TRUE,  FALSE, FALSE, FALSE),
    (role, 'buying_list', TRUE,  FALSE, FALSE, FALSE),
    (role, 'import',      FALSE, FALSE, FALSE, FALSE),
    (role, 'users',       FALSE, FALSE, FALSE, FALSE),
    (role, 'roles',       FALSE, FALSE, FALSE, FALSE),
    (role, 'settings',    TRUE,  FALSE, FALSE, FALSE)
  ON CONFLICT (role_id, resource) DO NOTHING;
END $$;

-- ╔═══════════════════════════════════════════════════════╗
-- ║  DONE! Now go create the admin user:                  ║
-- ║  1. Go to Authentication → Users → Add User           ║
-- ║  2. Email: admin@shakhis.com  Password: admin123      ║
-- ║  3. Then run the INSERT below with the UUID you get:   ║
-- ╚═══════════════════════════════════════════════════════╝

-- After creating the auth user, grab their UUID and run:
-- INSERT INTO app_users (auth_id, username, full_name, phone, role_id, is_active)
-- VALUES ('<paste-uuid-here>', 'admin', 'System Administrator', '', (SELECT id FROM roles WHERE name = 'Admin'), TRUE);
