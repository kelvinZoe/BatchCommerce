-- Fix tables that have update_updated_at triggers but were missing updated_at.
-- Without these columns, PATCH/UPDATE fails with:
-- record "new" has no field "updated_at"

ALTER TABLE IF EXISTS public.order_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.shipping_invoice_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

NOTIFY pgrst, 'reload schema';
