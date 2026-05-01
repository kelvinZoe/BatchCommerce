-- Align shipping_payments with client-based queue payments

ALTER TABLE shipping_payments
  ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE shipping_payments
  ALTER COLUMN delivery_id DROP NOT NULL;

UPDATE shipping_payments sp
SET client_id = d.customer_id
FROM deliveries d
WHERE sp.delivery_id = d.id
  AND sp.client_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_shipping_payments_batch_client
  ON shipping_payments (batch_name, client_id);
