-- Idempotent shipping_payments table for tracking per-client shipping payments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_payments') THEN
    CREATE TABLE shipping_payments (
      id serial PRIMARY KEY,
      delivery_id integer REFERENCES deliveries(id) ON DELETE CASCADE,
      client_id integer REFERENCES customers(id) ON DELETE SET NULL,
      batch_name text,
      total_fee numeric(10,2) DEFAULT 0,
      paid_amount numeric(10,2) DEFAULT 0,
      status text DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid'
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS shipping_payments_batch_idx ON shipping_payments(batch_name);
    CREATE UNIQUE INDEX IF NOT EXISTS shipping_payments_delivery_unique ON shipping_payments(delivery_id);
  END IF;
END$$;
