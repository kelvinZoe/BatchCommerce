-- Add pricing columns to products table (if not already present)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS stock_price NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS stock_discount_min_qty INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS stock_discount_price NUMERIC NOT NULL DEFAULT 0;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
