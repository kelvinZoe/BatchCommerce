-- A batch can be reopened for order editing only while its generated buying
-- list is still untouched. Reopening removes that derived list so the next
-- close can regenerate it from the edited orders without stale quantities.

CREATE OR REPLACE FUNCTION public.enforce_order_item_batch_editable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id BIGINT;
  v_batch_status TEXT;
BEGIN
  SELECT orders.batch_id, batches.status
  INTO v_batch_id, v_batch_status
  FROM public.orders
  JOIN public.batches
    ON batches.id = orders.batch_id
   AND batches.shop_id = orders.shop_id
  WHERE orders.id = NEW.order_id
    AND orders.shop_id = NEW.shop_id;

  IF NOT FOUND OR v_batch_status <> 'open' THEN
    RAISE EXCEPTION 'Order items can only be changed while their batch is open.' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.buying_list
    WHERE buying_list.shop_id = NEW.shop_id
      AND buying_list.batch_id = v_batch_id
  ) THEN
    RAISE EXCEPTION 'This reopened batch still has workflow records. Reopen it safely before editing orders.' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_require_editable_batch ON public.order_items;
CREATE TRIGGER trg_order_items_require_editable_batch
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_item_batch_editable();

CREATE OR REPLACE FUNCTION public.reopen_order_batch_safely(
  p_shop_id UUID,
  p_batch_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_batch public.batches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before reopening a batch.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_shop_permission(p_shop_id, 'orders', 'edit') THEN
    RAISE EXCEPTION 'You do not have permission to reopen this batch.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.shop_has_subscription_access(p_shop_id) THEN
    RAISE EXCEPTION 'This workspace is read-only until its subscription is renewed.' USING ERRCODE = '42501';
  END IF;

  SELECT batches.*
  INTO v_batch
  FROM public.batches
  WHERE batches.id = p_batch_id
    AND batches.shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_batch.status = 'open' AND NOT EXISTS (
    SELECT 1 FROM public.buying_list
    WHERE buying_list.shop_id = p_shop_id
      AND buying_list.batch_id = p_batch_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- Also repair a batch that an older client already marked open without
  -- clearing its untouched buying-list rows.
  IF v_batch.status NOT IN ('open', 'closed') THEN
    RAISE EXCEPTION 'This batch is not in a state that can be reopened.' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.buying_list
    WHERE buying_list.shop_id = p_shop_id
      AND buying_list.batch_id = p_batch_id
      AND (
        buying_list.status <> 'pending'
        OR COALESCE(buying_list.ordered_qty, 0) > 0
        OR COALESCE(buying_list.moved_to_arrivals, FALSE) = TRUE
      )
  ) THEN
    RAISE EXCEPTION 'This batch cannot be reopened because purchasing has already started.' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.arrival_items WHERE shop_id = p_shop_id AND batch_id = p_batch_id)
     OR EXISTS (SELECT 1 FROM public.damaged_items WHERE shop_id = p_shop_id AND batch_id = p_batch_id)
     OR EXISTS (SELECT 1 FROM public.damage_order_allocations WHERE shop_id = p_shop_id AND batch_id = p_batch_id)
     OR EXISTS (SELECT 1 FROM public.follow_ups WHERE shop_id = p_shop_id AND batch_id = p_batch_id)
     OR EXISTS (SELECT 1 FROM public.product_tracking WHERE shop_id = p_shop_id AND batch_id = p_batch_id)
     OR EXISTS (SELECT 1 FROM public.batch_product_shipping WHERE shop_id = p_shop_id AND batch_id = p_batch_id)
     OR EXISTS (SELECT 1 FROM public.shipping_invoices WHERE shop_id = p_shop_id AND batch_id = p_batch_id)
     OR EXISTS (SELECT 1 FROM public.shipping_batches WHERE shop_id = p_shop_id AND batch_id = p_batch_id)
     OR EXISTS (SELECT 1 FROM public.shipping_fees WHERE shop_id = p_shop_id AND batch_id = p_batch_id)
     OR EXISTS (SELECT 1 FROM public.shipping_payments WHERE shop_id = p_shop_id AND batch_id = p_batch_id)
     OR EXISTS (SELECT 1 FROM public.deliveries WHERE shop_id = p_shop_id AND batch_id = p_batch_id) THEN
    RAISE EXCEPTION 'This batch cannot be reopened because downstream processing has already started.' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.buying_list
  WHERE buying_list.shop_id = p_shop_id
    AND buying_list.batch_id = p_batch_id;

  UPDATE public.batches
  SET status = 'open',
      order_status = 'pending',
      buying_status = 'pending',
      delivery_status = 'not_sent',
      arrivals_sent = FALSE,
      stock_applied = FALSE,
      closed_at = NULL,
      updated_at = now()
  WHERE batches.id = p_batch_id
    AND batches.shop_id = p_shop_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_order_batch_safely(UUID, BIGINT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_order_batch_safely(UUID, BIGINT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
