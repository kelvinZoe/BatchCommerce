-- Align deliveries schema with app expectations

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS items TEXT;

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0;

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS delivery_category TEXT DEFAULT NULL;

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT '';

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS delivery_date DATE;

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS delivery_item_status TEXT DEFAULT 'pending';

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS batch_name TEXT DEFAULT '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE deliveries ALTER COLUMN batch_id DROP NOT NULL;
  END IF;
END$$;
