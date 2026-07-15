-- Move batch cascade deletion into a single guarded database function.
-- Products are intentionally preserved; batch-specific workflow rows are removed.

CREATE OR REPLACE FUNCTION public.delete_batch_cascade(
  p_shop_id UUID,
  p_batch_id BIGINT
)
RETURNS TABLE (
  deleted BOOLEAN,
  batch_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_name TEXT;
  v_order_ids BIGINT[];
  v_shipping_invoice_ids BIGINT[];
BEGIN
  IF p_shop_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'Shop and batch are required.';
  END IF;

  IF NOT public.has_shop_membership(p_shop_id) THEN
    RAISE EXCEPTION 'You cannot delete batches for this shop.';
  END IF;

  SELECT name
    INTO v_batch_name
  FROM public.batches
  WHERE id = p_batch_id
    AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT;
    RETURN;
  END IF;

  SELECT coalesce(array_agg(id), ARRAY[]::BIGINT[])
    INTO v_order_ids
  FROM public.orders
  WHERE shop_id = p_shop_id
    AND batch_id = p_batch_id;

  SELECT coalesce(array_agg(id), ARRAY[]::BIGINT[])
    INTO v_shipping_invoice_ids
  FROM public.shipping_invoices
  WHERE shop_id = p_shop_id
    AND batch_id = p_batch_id;

  DELETE FROM public.stock_sale_items
  WHERE shop_id = p_shop_id
    AND batch_product_id IN (
      SELECT id
      FROM public.batch_products
      WHERE shop_id = p_shop_id
        AND batch_id = p_batch_id
    );

  IF array_length(v_shipping_invoice_ids, 1) IS NOT NULL THEN
    DELETE FROM public.shipping_invoice_items
    WHERE shop_id = p_shop_id
      AND shipping_invoice_id = ANY(v_shipping_invoice_ids);
  END IF;

  DELETE FROM public.shipping_invoices
  WHERE shop_id = p_shop_id
    AND batch_id = p_batch_id;

  DELETE FROM public.shipping_fees
  WHERE shop_id = p_shop_id
    AND (
      batch_id = p_batch_id
      OR (v_batch_name IS NOT NULL AND batch_name = v_batch_name)
    );

  DELETE FROM public.shipping_payments
  WHERE shop_id = p_shop_id
    AND (
      batch_id = p_batch_id
      OR (v_batch_name IS NOT NULL AND batch_name = v_batch_name)
    );

  DELETE FROM public.shipping_batches
  WHERE shop_id = p_shop_id
    AND (
      batch_id = p_batch_id
      OR (v_batch_name IS NOT NULL AND batch_name = v_batch_name)
    );

  DELETE FROM public.deliveries
  WHERE shop_id = p_shop_id
    AND batch_id = p_batch_id;

  DELETE FROM public.damage_order_allocations
  WHERE shop_id = p_shop_id
    AND (
      batch_id = p_batch_id
      OR (v_batch_name IS NOT NULL AND batch_name = v_batch_name)
    );

  IF array_length(v_order_ids, 1) IS NOT NULL THEN
    DELETE FROM public.order_items
    WHERE shop_id = p_shop_id
      AND order_id = ANY(v_order_ids);
  END IF;

  DELETE FROM public.orders
  WHERE shop_id = p_shop_id
    AND batch_id = p_batch_id;

  DELETE FROM public.buying_list
  WHERE shop_id = p_shop_id
    AND batch_id = p_batch_id;

  DELETE FROM public.arrival_items
  WHERE shop_id = p_shop_id
    AND batch_id = p_batch_id;

  DELETE FROM public.damaged_items
  WHERE shop_id = p_shop_id
    AND batch_id = p_batch_id;

  DELETE FROM public.follow_ups
  WHERE shop_id = p_shop_id
    AND batch_id = p_batch_id;

  DELETE FROM public.product_tracking
  WHERE shop_id = p_shop_id
    AND batch_id = p_batch_id;

  DELETE FROM public.batch_product_shipping
  WHERE shop_id = p_shop_id
    AND batch_id = p_batch_id;

  DELETE FROM public.batch_products
  WHERE shop_id = p_shop_id
    AND batch_id = p_batch_id;

  DELETE FROM public.batches
  WHERE shop_id = p_shop_id
    AND id = p_batch_id;

  RETURN QUERY SELECT TRUE, v_batch_name;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_batch_cascade(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_batch_cascade(UUID, BIGINT) TO authenticated;
