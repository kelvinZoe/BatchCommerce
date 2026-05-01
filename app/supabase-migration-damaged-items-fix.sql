-- Align damaged_items schema with workflow + actor triggers
-- Safe for existing data (adds missing columns only)

-- Actor fields for set_actor_fields trigger
ALTER TABLE damaged_items
  ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL;

-- Normalized workflow columns
ALTER TABLE damaged_items
  ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES batches(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS batch_product_id BIGINT REFERENCES batch_products(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS requested_qty INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_qty INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT 'damaged_in_transit',
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Legacy compatibility columns
ALTER TABLE damaged_items
  ADD COLUMN IF NOT EXISTS arrival_item_id BIGINT,
  ADD COLUMN IF NOT EXISTS product_id BIGINT,
  ADD COLUMN IF NOT EXISTS expected_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batch_name TEXT;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_damaged_items_batch_id ON damaged_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_damaged_items_batch_product_id ON damaged_items(batch_product_id);
