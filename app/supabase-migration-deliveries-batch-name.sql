-- Add batch_name to deliveries for batch-scoped shipping flows

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS batch_name TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_deliveries_batch_name ON deliveries(batch_name);
