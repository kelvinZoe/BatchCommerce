-- Backfill canonical batch_id values for delivery and damage paths that may
-- still have legacy batch_name-only rows.

ALTER TABLE IF EXISTS public.deliveries
  ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES public.batches(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.damaged_items
  ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES public.batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_name TEXT;

UPDATE public.deliveries delivery
SET batch_id = batch.id
FROM public.batches batch
WHERE delivery.batch_id IS NULL
  AND delivery.shop_id = batch.shop_id
  AND delivery.batch_name = batch.name;

UPDATE public.damaged_items damaged
SET batch_id = batch.id
FROM public.batches batch
WHERE damaged.batch_id IS NULL
  AND damaged.shop_id = batch.shop_id
  AND damaged.batch_name = batch.name;

UPDATE public.damage_order_allocations allocation
SET batch_id = batch.id
FROM public.batches batch
WHERE allocation.batch_id IS NULL
  AND allocation.shop_id = batch.shop_id
  AND allocation.batch_name = batch.name;

CREATE INDEX IF NOT EXISTS idx_deliveries_shop_batch_name ON public.deliveries(shop_id, batch_name);
CREATE INDEX IF NOT EXISTS idx_damaged_items_shop_batch_name ON public.damaged_items(shop_id, batch_name);
