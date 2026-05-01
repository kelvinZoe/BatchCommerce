-- Idempotent shipping_fees table for per-item shipping fee tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_fees') THEN
    CREATE TABLE shipping_fees (
      id serial PRIMARY KEY,
      batch_name text,
      delivery_id integer REFERENCES deliveries(id) ON DELETE CASCADE,
      product_name text,
      quantity integer DEFAULT 1,
      fee numeric(10,2) DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS shipping_fees_unique_idx ON shipping_fees(delivery_id, product_name);
  END IF;
END$$;
