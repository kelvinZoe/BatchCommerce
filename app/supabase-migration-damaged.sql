-- supabase-migration-damaged.sql
-- Add damaged_items table for tracking deficits on arrivals

ALTER TABLE IF EXISTS arrivals -- ensure arrivals table exists
  ADD COLUMN IF NOT EXISTS batch_name TEXT;

-- Mark buying list items as moved when they are sent to arrivals
ALTER TABLE IF EXISTS buying_list
  ADD COLUMN IF NOT EXISTS moved_to_arrivals BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS damaged_items (
  id SERIAL PRIMARY KEY,
  arrival_item_id INTEGER REFERENCES arrivals(id) ON DELETE SET NULL,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  batch_name TEXT,
  expected_quantity INTEGER NOT NULL DEFAULT 0,
  damaged_quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
