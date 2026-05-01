-- Add moved_to_arrivals flag for buying_list in normalized workflow
ALTER TABLE buying_list
  ADD COLUMN IF NOT EXISTS moved_to_arrivals BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill any NULLs just in case
UPDATE buying_list
SET moved_to_arrivals = FALSE
WHERE moved_to_arrivals IS NULL;
