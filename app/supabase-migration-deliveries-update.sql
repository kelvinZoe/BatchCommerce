-- Migration: Add delivery pipeline columns
-- Run this in Supabase SQL Editor

-- 1. Add delivery_status to order_batches (tracks batch-level delivery progress)
ALTER TABLE order_batches ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'not_sent';

-- 2. Add batch_name to deliveries (links deliveries back to their batch)
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS batch_name TEXT DEFAULT '';

-- 3. Add delivery_item_status to deliveries (per-client delivery progress)
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_item_status TEXT DEFAULT 'pending';
