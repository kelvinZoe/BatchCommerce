-- Fix shipping_payments client_id FK to point at customers

ALTER TABLE shipping_payments
  ADD COLUMN IF NOT EXISTS client_id BIGINT;

ALTER TABLE shipping_payments
  DROP CONSTRAINT IF EXISTS shipping_payments_client_id_fkey;

ALTER TABLE shipping_payments
  ADD CONSTRAINT shipping_payments_client_id_fkey
  FOREIGN KEY (client_id)
  REFERENCES customers(id)
  ON DELETE SET NULL;
