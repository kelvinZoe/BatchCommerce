-- Phase 5 RBAC support: persisted Stock Sales close/finalize state.
-- Existing stock sales are already recorded/finalized by the app, so they are
-- backfilled as closed to preserve current behavior.

ALTER TABLE public.stock_sales
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'closed',
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL;

ALTER TABLE public.stock_sales
  ALTER COLUMN status SET DEFAULT 'closed';

UPDATE public.stock_sales
SET status = 'closed'
WHERE status IS NULL
   OR status = ''
   OR status NOT IN ('open', 'closed', 'cancelled');

UPDATE public.stock_sales
SET
  closed_at = COALESCE(closed_at, created_at),
  closed_by = COALESCE(closed_by, updated_by, created_by)
WHERE status = 'closed'
  AND closed_at IS NULL;

ALTER TABLE public.stock_sales
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.stock_sales') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'stock_sales_status_check'
     ) THEN
    ALTER TABLE public.stock_sales
      ADD CONSTRAINT stock_sales_status_check
      CHECK (status IN ('open', 'closed', 'cancelled'))
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_sales_shop_status_created
  ON public.stock_sales(shop_id, status, created_at DESC);
