-- supabase-init.sql
-- Idempotent init migration to create core tables, roles, permissions, and seed an admin app_user row.
-- Run this in the Supabase SQL editor or via psql against your database.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Auto-update trigger helper: keeps `updated_at` fresh on updates
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Role permissions (simple ACL mapping)
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- App users table (application-level user record linked to auth.users via auth_id)
CREATE TABLE IF NOT EXISTS app_users (
  id SERIAL PRIMARY KEY,
  auth_id UUID UNIQUE, -- set this to the Supabase Auth user's id (auth.users.id)
  email TEXT,
  full_name TEXT,
  role_id INTEGER REFERENCES roles(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure expected columns exist on older schemas and provide defaults where appropriate
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'email'
  ) THEN
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS full_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'role_id'
  ) THEN
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role_id INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END$$;

-- Ensure a unique index on email exists so ON CONFLICT (email) works
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure product columns exist on older schemas (avoid errors when adding indexes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'sku'
  ) THEN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'description'
  ) THEN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'stock'
  ) THEN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;
  END IF;
END$$;

-- If an older schema used `shipping_fee` on products, migrate it into `purchase_price` then drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'shipping_fee'
  ) THEN
    EXECUTE 'UPDATE products SET purchase_price = COALESCE(shipping_fee, 0) WHERE purchase_price = 0';
    EXECUTE 'ALTER TABLE products DROP COLUMN IF EXISTS shipping_fee';
  END IF;
END$$;

-- Buying list items
CREATE TABLE IF NOT EXISTS buying_list (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'client',
  moved_to_arrivals BOOLEAN NOT NULL DEFAULT FALSE,
  ordered BOOLEAN NOT NULL DEFAULT FALSE,
  ordered_quantity INTEGER NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure buying_list has the new columns on older schemas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buying_list' AND column_name = 'moved_to_arrivals'
  ) THEN
    ALTER TABLE buying_list ADD COLUMN IF NOT EXISTS moved_to_arrivals BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buying_list' AND column_name = 'ordered_quantity'
  ) THEN
    ALTER TABLE buying_list ADD COLUMN IF NOT EXISTS ordered_quantity INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buying_list' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE buying_list ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;
  END IF;
END$$;

-- Order batches (grouping of orders)
CREATE TABLE IF NOT EXISTS order_batches (
  id SERIAL PRIMARY KEY,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  order_status TEXT NOT NULL DEFAULT 'pending',
  buying_status TEXT NOT NULL DEFAULT 'pending',
  delivery_status TEXT NOT NULL DEFAULT 'not_sent',
  closed_at TIMESTAMPTZ,
  stock_applied BOOLEAN NOT NULL DEFAULT FALSE,
  arrivals_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index and trigger for order_batches
CREATE INDEX IF NOT EXISTS idx_order_batches_status ON order_batches(status);
CREATE INDEX IF NOT EXISTS idx_order_batches_order_status ON order_batches(order_status);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_order_batches_updated'
  ) THEN
    CREATE TRIGGER trg_order_batches_updated BEFORE UPDATE ON order_batches
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END$$;

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER REFERENCES order_batches(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  items JSONB DEFAULT '[]'::jsonb, -- array of line items: {product_id, qty, price}
  total NUMERIC(12,2) DEFAULT 0,
  refunded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Arrivals and arrival items
CREATE TABLE IF NOT EXISTS arrivals (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER REFERENCES order_batches(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arrival_items (
  id SERIAL PRIMARY KEY,
  arrival_id INTEGER NOT NULL REFERENCES arrivals(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  expected_quantity INTEGER NOT NULL DEFAULT 0,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure `confirmed` exists on arrival_items so confirmed state is persisted
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'arrival_items'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name = 'arrival_items' AND column_name = 'confirmed'
    ) THEN
      ALTER TABLE arrival_items ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
  END IF;
END$$;

-- Damaged items: records created when arrivals have deficits or items are damaged
CREATE TABLE IF NOT EXISTS damaged_items (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id INTEGER REFERENCES batch_products(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  requested_qty INTEGER NOT NULL DEFAULT 0,
  damaged_qty INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT,
  updated_by BIGINT
);

-- Ensure damaged_items columns exist on older schemas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'damaged_items'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'damaged_items' AND column_name = 'batch_id'
    ) THEN
      ALTER TABLE damaged_items ADD COLUMN IF NOT EXISTS batch_id INTEGER;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'damaged_items' AND column_name = 'batch_product_id'
    ) THEN
      ALTER TABLE damaged_items ADD COLUMN IF NOT EXISTS batch_product_id INTEGER;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'damaged_items' AND column_name = 'requested_qty'
    ) THEN
      ALTER TABLE damaged_items ADD COLUMN IF NOT EXISTS requested_qty INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'damaged_items' AND column_name = 'damaged_qty'
    ) THEN
      ALTER TABLE damaged_items ADD COLUMN IF NOT EXISTS damaged_qty INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'damaged_items' AND column_name = 'reason'
    ) THEN
      ALTER TABLE damaged_items ADD COLUMN IF NOT EXISTS reason TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'damaged_items' AND column_name = 'notes'
    ) THEN
      ALTER TABLE damaged_items ADD COLUMN IF NOT EXISTS notes TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'damaged_items' AND column_name = 'created_by'
    ) THEN
      ALTER TABLE damaged_items ADD COLUMN IF NOT EXISTS created_by BIGINT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'damaged_items' AND column_name = 'updated_by'
    ) THEN
      ALTER TABLE damaged_items ADD COLUMN IF NOT EXISTS updated_by BIGINT;
    END IF;
  END IF;
END$$;

-- Helpful indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_damaged_items_batch_id ON damaged_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_damaged_items_batch_product_id ON damaged_items(batch_product_id);
CREATE INDEX IF NOT EXISTS idx_damaged_items_product_id ON damaged_items(product_id);

-- Destructive: recreate `damaged_items` table with stable schema (run if you want to reset)
-- WARNING: this drops existing damaged records. Run manually in your Supabase SQL editor if desired.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'damaged_items') THEN
    PERFORM 1; -- leave existing unless user explicitly runs the block below
  END IF;
END$$;

-- If you want to recreate the table (destructive), uncomment and run the block below manually in your DB.
--
-- DROP TABLE IF EXISTS damaged_items CASCADE;
-- CREATE TABLE damaged_items (
--   id SERIAL PRIMARY KEY,
--   arrival_item_id INTEGER,
--   product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
--   batch_name TEXT,
--   expected_quantity INTEGER NOT NULL DEFAULT 0,
--   damaged_quantity INTEGER NOT NULL DEFAULT 0,
--   quantity INTEGER NOT NULL DEFAULT 0,
--   reason TEXT,
--   notes TEXT,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );
-- CREATE INDEX idx_damaged_items_product_id ON damaged_items(product_id);
-- CREATE INDEX idx_damaged_items_arrival_item_id ON damaged_items(arrival_item_id);
-- CREATE INDEX idx_damaged_items_batch_name ON damaged_items(batch_name);
--
-- -- Keep `quantity` in sync with `damaged_quantity` for legacy compatibility
-- CREATE OR REPLACE FUNCTION sync_damaged_quantity()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.quantity = COALESCE(NEW.damaged_quantity, NEW.quantity, 0);
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- CREATE TRIGGER trg_sync_damaged_quantity BEFORE INSERT OR UPDATE ON damaged_items
-- FOR EACH ROW EXECUTE FUNCTION sync_damaged_quantity();

-- Deliveries (minimal)
CREATE TABLE IF NOT EXISTS deliveries (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add delivery pipeline columns if not present (batch link + per-item status)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'batch_name'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS batch_name TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'delivery_item_status'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_item_status TEXT DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'delivery_category'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_category TEXT DEFAULT NULL;
  END IF;
END$$;

-- Ensure buying_list.order_count exists (migration from order-batches file)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buying_list' AND column_name = 'order_count'
  ) THEN
    ALTER TABLE buying_list ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0;
  END IF;
END$$;

-- Seed admin role and permissions
INSERT INTO roles (name, description)
VALUES ('admin', 'Administrator with full access')
ON CONFLICT (name) DO NOTHING;

-- Expenses table (some deployments may already have this via other migrations)
CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  recipient TEXT DEFAULT '',
  payment_method TEXT DEFAULT 'cash',
  reference TEXT DEFAULT '',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT DEFAULT '',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

-- Auto-update trigger for expenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_expenses_updated'
  ) THEN
    CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON expenses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END$$;

-- Give admin wildcard permission if not present
DO $$
BEGIN
  -- Ensure the 'action' column exists (some older schemas may not have it)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'role_permissions' AND column_name = 'action'
  ) THEN
    ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT '*';
  END IF;

  -- Insert a wildcard permission for admin if not present
  IF NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN roles r ON r.id = rp.role_id
    WHERE r.name = 'admin' AND rp.resource = '*' AND rp.action = '*'
  ) THEN
    INSERT INTO role_permissions (role_id, resource, action)
    SELECT id, '*', '*' FROM roles WHERE name = 'admin';
  END IF;
END$$;

-- Seed an admin app_user row placeholder (link auth_id after creating the Auth user)
-- Ensure `username` column exists and backfill missing values so INSERTs with no username don't fail
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'username'
  ) THEN
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS username TEXT;
  END IF;

  -- Backfill username from email or fallback to user{id}
  UPDATE app_users
  SET username = COALESCE(NULLIF(username, ''), email, ('user' || id::text))
  WHERE username IS NULL OR username = '';

  -- Try to enforce NOT NULL for username, but don't fail the migration if it cannot be applied
  BEGIN
    ALTER TABLE app_users ALTER COLUMN username SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping enforce NOT NULL on app_users.username: %', SQLERRM;
  END;
END$$;

INSERT INTO app_users (auth_id, email, full_name, role_id, username)
SELECT NULL, 'admin@example.com', 'Administrator', r.id, 'admin'
FROM roles r
WHERE r.name = 'admin'
ON CONFLICT (email) DO NOTHING;

-- Ensure indexes used by the app exist
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_app_users_auth_id ON app_users(auth_id);

-- Helpful note
-- After running this migration you must create a Supabase Auth user (via the dashboard
-- or the service_role API) and then run:
--
-- UPDATE app_users SET auth_id = '<AUTH_USER_UUID>' WHERE email = 'admin@example.com';
--
-- Replace <AUTH_USER_UUID> with the UUID returned by Supabase Auth.
