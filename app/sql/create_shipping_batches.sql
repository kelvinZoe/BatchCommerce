-- Idempotent shipping_batches table for storing per-batch totals
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_batches') THEN
    CREATE TABLE shipping_batches (
      id serial PRIMARY KEY,
      batch_name text UNIQUE,
      total_fee numeric(12,2) DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS shipping_batches_name_idx ON shipping_batches(batch_name);
  END IF;
END$$;
