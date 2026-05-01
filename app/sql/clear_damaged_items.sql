-- WARNING: Destructive. This will remove ALL rows from `damaged_items` and reset the sequence.
-- Run this in the Supabase SQL editor or via psql against your database if you're sure.

TRUNCATE TABLE damaged_items RESTART IDENTITY CASCADE;

-- If you prefer to drop and recreate the table (also destructive), you can run the block below instead:
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
