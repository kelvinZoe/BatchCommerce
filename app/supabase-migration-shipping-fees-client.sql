-- Add client_id to shipping_fees for pre-delivery shipping stage

ALTER TABLE shipping_fees
  ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id BIGINT REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shipping_fees_batch_client ON shipping_fees(batch_name, client_id);
