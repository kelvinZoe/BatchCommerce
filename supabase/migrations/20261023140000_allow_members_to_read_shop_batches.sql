-- Batch headers are shared workflow context across Products, Orders, Buying
-- List, Arrivals, Shipping, and Deliveries. Requiring the separate `batches`
-- resource to read them makes those pages appear empty for otherwise
-- authorized staff. Keep mutations permission-controlled, but allow every
-- active member to read batch metadata for their own shop.

BEGIN;

DROP POLICY IF EXISTS "Authenticated can read batches" ON public.batches;
DROP POLICY IF EXISTS "Role can view batches" ON public.batches;
DROP POLICY IF EXISTS "Active shop members can read batches" ON public.batches;

CREATE POLICY "Active shop members can read batches"
  ON public.batches
  FOR SELECT
  TO authenticated
  USING (public.has_shop_membership(shop_id));

GRANT SELECT ON public.batches TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
