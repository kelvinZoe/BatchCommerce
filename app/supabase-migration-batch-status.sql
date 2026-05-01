-- ============================================================
-- Shakhis Commerce – Move order status to batch level
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add order_status column to order_batches (batch-level status)
ALTER TABLE order_batches ADD COLUMN IF NOT EXISTS order_status TEXT NOT NULL DEFAULT 'pending';

-- 2. Drop the per-order status column from orders
ALTER TABLE orders DROP COLUMN IF EXISTS status;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  DONE! Order status is now at the batch level.            ║
-- ║  Individual orders keep only payment_status.              ║
-- ╚═══════════════════════════════════════════════════════════╝
