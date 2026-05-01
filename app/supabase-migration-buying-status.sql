-- ============================================================
-- Shakhis Commerce – Add buying_status to order_batches
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add buying_status column to order_batches (batch-level buying status)
ALTER TABLE order_batches ADD COLUMN IF NOT EXISTS buying_status TEXT NOT NULL DEFAULT 'pending';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  DONE! Buying status is now tracked at the batch level.   ║
-- ║  The buying_list table status column is kept for legacy   ║
-- ║  but the UI now uses the batch-level buying_status.       ║
-- ╚═══════════════════════════════════════════════════════════╝
