-- Backfill arrival_items for buying_list rows already marked as moved
-- Also ensure normalized columns/index exist for workflow schema

-- Ensure normalized columns exist
ALTER TABLE arrival_items
  ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES batches(id) ON DELETE CASCADE;
ALTER TABLE arrival_items
  ADD COLUMN IF NOT EXISTS batch_product_id BIGINT REFERENCES batch_products(id) ON DELETE CASCADE;
ALTER TABLE arrival_items
  ADD COLUMN IF NOT EXISTS product_id BIGINT REFERENCES products(id) ON DELETE RESTRICT;
ALTER TABLE arrival_items
  ADD COLUMN IF NOT EXISTS requested_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE arrival_items
  ADD COLUMN IF NOT EXISTS received_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE arrival_items
  ADD COLUMN IF NOT EXISTS confirmed_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE arrival_items
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE arrival_items
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE arrival_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure unique index for upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_arrival_items_batch_product_unique
  ON arrival_items(batch_id, batch_product_id);

-- Backfill missing arrival_items for moved buying list rows
INSERT INTO arrival_items (batch_id, batch_product_id, product_id, requested_qty, received_qty, confirmed_qty, status)
SELECT
  bl.batch_id,
  bl.batch_product_id,
  bl.product_id,
  COALESCE(bl.ordered_qty, bl.requested_qty, 0) AS requested_qty,
  0 AS received_qty,
  0 AS confirmed_qty,
  'pending' AS status
FROM buying_list bl
LEFT JOIN arrival_items ai
  ON ai.batch_id = bl.batch_id
  AND ai.batch_product_id = bl.batch_product_id
WHERE bl.moved_to_arrivals = TRUE
  AND ai.id IS NULL;

-- Ensure batches reflect arrivals activity
UPDATE batches b
SET arrivals_sent = TRUE
WHERE EXISTS (
  SELECT 1 FROM buying_list bl
  WHERE bl.batch_id = b.id
    AND bl.moved_to_arrivals = TRUE
);
