-- Add stock column to products for workflow schema
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

-- Backfill any NULLs just in case
UPDATE products
SET stock = 0
WHERE stock IS NULL;
