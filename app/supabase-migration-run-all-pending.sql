-- ============================================================
-- Shakhis Commerce – Combined Pending Migrations
-- Run this ONCE in the Supabase SQL Editor
-- Covers: batch status, buying status, delivery pipeline, expenses
-- ============================================================

-- ─── ORDER BATCHES: order_status ──────────────────────────
ALTER TABLE order_batches ADD COLUMN IF NOT EXISTS order_status TEXT NOT NULL DEFAULT 'pending';

-- ─── ORDER BATCHES: buying_status ─────────────────────────
ALTER TABLE order_batches ADD COLUMN IF NOT EXISTS buying_status TEXT NOT NULL DEFAULT 'pending';

-- ─── ORDER BATCHES: delivery_status ───────────────────────
ALTER TABLE order_batches ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'not_sent';

-- ─── DELIVERIES: batch_name + delivery_item_status ────────
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS batch_name TEXT DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_item_status TEXT DEFAULT 'pending';

-- ─── EXPENSES TABLE ───────────────────────────────────────
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

-- ╔════════════════════════════════════════════════════════════╗
-- ║  DONE! All pending migrations applied.                     ║
-- ║  You can now use:                                          ║
-- ║  • Batch-level order status, buying status, delivery status║
-- ║  • Delivery pipeline (batch_name, delivery_item_status)    ║
-- ║  • Expenses module                                         ║
-- ╚════════════════════════════════════════════════════════════╝
