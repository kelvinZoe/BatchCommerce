-- Store the shop's dedicated shipping-fee payment destination so every
-- authorized workspace user sends customers the same number.

BEGIN;

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS shipping_payment_number TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.shops.shipping_payment_number IS
  'Phone or MoMo number included in customer shipping-fee messages.';

COMMIT;

NOTIFY pgrst, 'reload schema';
