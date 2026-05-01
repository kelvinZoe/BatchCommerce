-- ============================================================
-- Shakhis Commerce – Order Batches & Delivery Categories Migration
-- Run this in the Supabase SQL Editor AFTER the original migration
-- ============================================================

-- ╔═══════════════════════════════════════╗
-- ║  1. ORDER BATCHES TABLE               ║
-- ╚═══════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS order_batches (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',     -- 'open' or 'closed'
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_batches_status ON order_batches(status);

-- Auto-update trigger
CREATE TRIGGER trg_order_batches_updated BEFORE UPDATE ON order_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ╔═══════════════════════════════════════╗
-- ║  2. ADD COLUMNS TO ORDERS TABLE       ║
-- ╚═══════════════════════════════════════╝

-- Link orders to batches
ALTER TABLE orders ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES order_batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_batch_id ON orders(batch_id);

-- Delivery category for each order
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_category TEXT DEFAULT NULL;

-- ╔═══════════════════════════════════════╗
-- ║  3. ADD DELIVERY CATEGORY TO          ║
-- ║     DELIVERIES TABLE                  ║
-- ╚═══════════════════════════════════════╝

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_category TEXT DEFAULT NULL;

-- ╔═══════════════════════════════════════╗
-- ║  4. ADD order_count TO BUYING LIST    ║
-- ╚═══════════════════════════════════════╝

ALTER TABLE buying_list ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0;

-- ╔═══════════════════════════════════════╗
-- ║  5. ROW LEVEL SECURITY FOR BATCHES    ║
-- ╚═══════════════════════════════════════╝

ALTER TABLE order_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read order_batches" ON order_batches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert order_batches" ON order_batches
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update order_batches" ON order_batches
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete order_batches" ON order_batches
  FOR DELETE TO authenticated USING (true);

-- ╔═══════════════════════════════════════════════════════╗
-- ║  DONE! Order batches + delivery categories ready.     ║
-- ╚═══════════════════════════════════════════════════════╝
