-- Phase 3: database and tenancy hardening.
-- This migration is intentionally idempotent because the existing project has
-- drift between the live Supabase schema, the empty remote baseline migration,
-- and the multishop reset reference SQL.

-- ---------------------------------------------------------------------------
-- Membership helper used by RLS policies.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_shop_membership(p_shop_id UUID)
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

-- ---------------------------------------------------------------------------
-- Damage allocation table used by arrivals/orders/shipping/dashboard flows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.damage_order_allocations (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE CASCADE,
  batch_id BIGINT REFERENCES public.batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT REFERENCES public.batch_products(id) ON DELETE SET NULL,
  product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
  client_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  batch_name TEXT,
  original_quantity INTEGER NOT NULL DEFAULT 0,
  adjusted_quantity INTEGER NOT NULL DEFAULT 0,
  damaged_quantity INTEGER NOT NULL DEFAULT 0,
  arrival_item_id BIGINT REFERENCES public.arrival_items(id) ON DELETE SET NULL,
  damaged_item_id BIGINT REFERENCES public.damaged_items(id) ON DELETE SET NULL,
  reason TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  undone_at TIMESTAMPTZ,
  undone_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.damage_order_allocations
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES public.batches(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS batch_product_id BIGINT REFERENCES public.batch_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_name TEXT,
  ADD COLUMN IF NOT EXISTS original_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjusted_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arrival_item_id BIGINT REFERENCES public.arrival_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS damaged_item_id BIGINT REFERENCES public.damaged_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS undone_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill tenant/batch metadata where old rows can be inferred from order items.
UPDATE public.damage_order_allocations doa
SET
  shop_id = COALESCE(doa.shop_id, oi.shop_id),
  batch_id = COALESCE(doa.batch_id, o.batch_id),
  batch_product_id = COALESCE(doa.batch_product_id, oi.batch_product_id),
  product_id = COALESCE(doa.product_id, oi.product_id),
  client_id = COALESCE(doa.client_id, o.customer_id),
  batch_name = COALESCE(doa.batch_name, b.name)
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
LEFT JOIN public.batches b ON b.id = o.batch_id
WHERE doa.order_item_id = oi.id
  AND (
    doa.shop_id IS NULL
    OR doa.batch_id IS NULL
    OR doa.batch_product_id IS NULL
    OR doa.product_id IS NULL
    OR doa.client_id IS NULL
    OR doa.batch_name IS NULL
  );

-- ---------------------------------------------------------------------------
-- Pricing columns that app code expects on products.
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS stock_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_discount_min_qty INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_discount_price NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Batch identifiers for shipping/ledger rows that historically used names.
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.shipping_fees
  ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES public.batches(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.shipping_payments
  ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES public.batches(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.shipping_batches
  ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES public.batches(id) ON DELETE CASCADE;

UPDATE public.shipping_fees sf
SET batch_id = b.id
FROM public.batches b
WHERE sf.batch_id IS NULL
  AND sf.shop_id = b.shop_id
  AND sf.batch_name = b.name;

UPDATE public.shipping_payments sp
SET batch_id = b.id
FROM public.batches b
WHERE sp.batch_id IS NULL
  AND sp.shop_id = b.shop_id
  AND sp.batch_name = b.name;

UPDATE public.shipping_batches sb
SET batch_id = b.id
FROM public.batches b
WHERE sb.batch_id IS NULL
  AND sb.shop_id = b.shop_id
  AND sb.batch_name = b.name;

-- ---------------------------------------------------------------------------
-- Indexes for tenant scoping and common app filters.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_batches_shop_status_created ON public.batches(shop_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_shop_active_name ON public.products(shop_id, is_active, name);
CREATE INDEX IF NOT EXISTS idx_batch_products_shop_batch_product ON public.batch_products(shop_id, batch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop_name ON public.customers(shop_id, name);
CREATE INDEX IF NOT EXISTS idx_orders_shop_batch_customer_created ON public.orders(shop_id, batch_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_shop_order ON public.order_items(shop_id, order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_shop_batch_product ON public.order_items(shop_id, batch_product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_shop_product ON public.order_items(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_buying_list_shop_batch_status ON public.buying_list(shop_id, batch_id, status);
CREATE INDEX IF NOT EXISTS idx_buying_list_shop_batch_product ON public.buying_list(shop_id, batch_product_id);
CREATE INDEX IF NOT EXISTS idx_arrival_items_shop_batch_status ON public.arrival_items(shop_id, batch_id, status);
CREATE INDEX IF NOT EXISTS idx_arrival_items_shop_batch_product ON public.arrival_items(shop_id, batch_product_id);
CREATE INDEX IF NOT EXISTS idx_damaged_items_shop_batch_product ON public.damaged_items(shop_id, batch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_damage_alloc_shop_batch_product_client ON public.damage_order_allocations(shop_id, batch_id, product_id, client_id);
CREATE INDEX IF NOT EXISTS idx_damage_alloc_shop_order_item_active ON public.damage_order_allocations(shop_id, order_item_id, is_active);
CREATE INDEX IF NOT EXISTS idx_damage_alloc_shop_batch_name ON public.damage_order_allocations(shop_id, batch_name);
CREATE INDEX IF NOT EXISTS idx_product_tracking_shop_batch_product ON public.product_tracking(shop_id, batch_id, batch_product_id);
CREATE INDEX IF NOT EXISTS idx_shipping_fees_shop_batch ON public.shipping_fees(shop_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_shipping_fees_shop_batch_name ON public.shipping_fees(shop_id, batch_name);
CREATE INDEX IF NOT EXISTS idx_shipping_fees_shop_client ON public.shipping_fees(shop_id, client_id);
CREATE INDEX IF NOT EXISTS idx_shipping_fees_shop_delivery ON public.shipping_fees(shop_id, delivery_id);
CREATE INDEX IF NOT EXISTS idx_shipping_payments_shop_batch ON public.shipping_payments(shop_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_shipping_payments_shop_batch_name_client ON public.shipping_payments(shop_id, batch_name, client_id);
CREATE INDEX IF NOT EXISTS idx_shipping_batches_shop_batch ON public.shipping_batches(shop_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_shop_batch_customer ON public.deliveries(shop_id, batch_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_shop_status ON public.deliveries(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_shop_item_status ON public.deliveries(shop_id, delivery_item_status);
CREATE INDEX IF NOT EXISTS idx_stock_sales_shop_customer_created ON public.stock_sales(shop_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_sale_items_shop_sale ON public.stock_sale_items(shop_id, stock_sale_id);
CREATE INDEX IF NOT EXISTS idx_stock_sale_items_shop_batch_product ON public.stock_sale_items(shop_id, batch_product_id);
CREATE INDEX IF NOT EXISTS idx_expenses_shop_date ON public.expenses(shop_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_role_permissions_shop_role_resource ON public.role_permissions(shop_id, role_id, resource);

-- ---------------------------------------------------------------------------
-- RLS coverage for the allocation table.
-- ---------------------------------------------------------------------------
ALTER TABLE public.damage_order_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read damage_order_allocations" ON public.damage_order_allocations;
DROP POLICY IF EXISTS "Authenticated can write damage_order_allocations" ON public.damage_order_allocations;

CREATE POLICY "Authenticated can read damage_order_allocations"
  ON public.damage_order_allocations
  FOR SELECT TO authenticated
  USING (public.has_shop_membership(shop_id));

CREATE POLICY "Authenticated can write damage_order_allocations"
  ON public.damage_order_allocations
  FOR ALL TO authenticated
  USING (public.has_shop_membership(shop_id))
  WITH CHECK (public.has_shop_membership(shop_id));

-- Attach standard triggers when the helper functions exist in the live schema.
DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_damage_order_allocations_updated ON public.damage_order_allocations;
    CREATE TRIGGER trg_damage_order_allocations_updated
      BEFORE UPDATE ON public.damage_order_allocations
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;

  IF to_regprocedure('public.set_shop_fields()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_damage_order_allocations_shop ON public.damage_order_allocations;
    CREATE TRIGGER trg_damage_order_allocations_shop
      BEFORE INSERT OR UPDATE ON public.damage_order_allocations
      FOR EACH ROW EXECUTE FUNCTION public.set_shop_fields();
  END IF;

  IF to_regprocedure('public.set_actor_fields()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_damage_order_allocations_actor ON public.damage_order_allocations;
    CREATE TRIGGER trg_damage_order_allocations_actor
      BEFORE INSERT OR UPDATE ON public.damage_order_allocations
      FOR EACH ROW EXECUTE FUNCTION public.set_actor_fields();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Status/check constraints. NOT VALID avoids breaking existing historical rows
-- while enforcing valid values for new/updated rows.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.shop_memberships') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_memberships_membership_status_check') THEN
    ALTER TABLE public.shop_memberships ADD CONSTRAINT shop_memberships_membership_status_check CHECK (membership_status IN ('pending_verification', 'active', 'suspended', 'removed')) NOT VALID;
  END IF;

  IF to_regclass('public.batches') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batches_status_check') THEN
    ALTER TABLE public.batches ADD CONSTRAINT batches_status_check CHECK (status IN ('open', 'closed')) NOT VALID;
  END IF;
  IF to_regclass('public.batches') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batches_order_status_check') THEN
    ALTER TABLE public.batches ADD CONSTRAINT batches_order_status_check CHECK (order_status IN ('pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled')) NOT VALID;
  END IF;
  IF to_regclass('public.batches') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batches_buying_status_check') THEN
    ALTER TABLE public.batches ADD CONSTRAINT batches_buying_status_check CHECK (buying_status IN ('pending', 'ordered', 'shipped', 'arrived')) NOT VALID;
  END IF;
  IF to_regclass('public.batches') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batches_delivery_status_check') THEN
    ALTER TABLE public.batches ADD CONSTRAINT batches_delivery_status_check CHECK (delivery_status IN ('not_sent', 'pending', 'in_progress', 'completed')) NOT VALID;
  END IF;

  IF to_regclass('public.orders') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')) NOT VALID;
  END IF;

  IF to_regclass('public.buying_list') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buying_list_status_check') THEN
    ALTER TABLE public.buying_list ADD CONSTRAINT buying_list_status_check CHECK (status IN ('pending', 'ordered', 'shipped', 'arrived')) NOT VALID;
  END IF;

  IF to_regclass('public.arrival_items') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'arrival_items_status_check') THEN
    ALTER TABLE public.arrival_items ADD CONSTRAINT arrival_items_status_check CHECK (status IN ('pending', 'confirmed', 'sent_to_shipping')) NOT VALID;
  END IF;

  IF to_regclass('public.shipping_invoices') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipping_invoices_status_check') THEN
    ALTER TABLE public.shipping_invoices ADD CONSTRAINT shipping_invoices_status_check CHECK (status IN ('unpaid', 'partial', 'paid')) NOT VALID;
  END IF;
  IF to_regclass('public.shipping_payments') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipping_payments_status_check') THEN
    ALTER TABLE public.shipping_payments ADD CONSTRAINT shipping_payments_status_check CHECK (status IN ('unpaid', 'partial', 'paid')) NOT VALID;
  END IF;

  IF to_regclass('public.deliveries') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_status_check') THEN
    ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_status_check CHECK (status IN ('pending', 'in_transit', 'delivered', 'failed')) NOT VALID;
  END IF;
  IF to_regclass('public.deliveries') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_item_status_check') THEN
    ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_item_status_check CHECK (delivery_item_status IN ('pending', 'packaged', 'delivering', 'delivered')) NOT VALID;
  END IF;

  IF to_regclass('public.stock_sales') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_sales_sale_channel_check') THEN
    ALTER TABLE public.stock_sales ADD CONSTRAINT stock_sales_sale_channel_check CHECK (sale_channel IN ('walk_in', 'online', 'other')) NOT VALID;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
