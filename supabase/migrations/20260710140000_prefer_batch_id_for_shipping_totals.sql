-- Make shipping batch totals use batch_id as the canonical key.
-- batch_name stays available for display/legacy rows, but new total upserts
-- should target (shop_id, batch_id) when the batch can be resolved.

UPDATE public.shipping_batches sb
SET batch_id = b.id
FROM public.batches b
WHERE sb.batch_id IS NULL
  AND sb.shop_id = b.shop_id
  AND sb.batch_name = b.name;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY shop_id, batch_id
      ORDER BY id DESC
    ) AS row_number
  FROM public.shipping_batches
  WHERE batch_id IS NOT NULL
)
DELETE FROM public.shipping_batches sb
USING ranked
WHERE sb.id = ranked.id
  AND ranked.row_number > 1;

DO $$
BEGIN
  IF to_regclass('public.shipping_batches') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'shipping_batches_shop_batch_id_key'
    )
  THEN
    ALTER TABLE public.shipping_batches
      ADD CONSTRAINT shipping_batches_shop_batch_id_key UNIQUE (shop_id, batch_id);
  END IF;
END $$;
