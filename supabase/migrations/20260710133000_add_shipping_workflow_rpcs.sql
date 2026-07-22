-- Move shipping workflow transitions into guarded transactional functions.
-- These keep queue creation, tracking rows, delivery creation, payment updates,
-- and batch status changes atomic instead of splitting them across browser calls.

CREATE OR REPLACE FUNCTION public.send_confirmed_arrivals_to_shipping(
  p_shop_id UUID,
  p_batch_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch RECORD;
  v_confirmed_count INTEGER;
  v_product_ids BIGINT[];
BEGIN
  IF p_shop_id IS NULL OR nullif(trim(coalesce(p_batch_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Shop and batch are required.';
  END IF;

  IF NOT public.has_shop_membership(p_shop_id) THEN
    RAISE EXCEPTION 'You cannot send arrivals for this shop.';
  END IF;

  SELECT id, name, status, arrivals_sent
    INTO v_batch
  FROM public.batches
  WHERE shop_id = p_shop_id
    AND name = p_batch_name
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF coalesce(v_batch.status, 'open') <> 'closed' OR coalesce(v_batch.arrivals_sent, FALSE) <> TRUE THEN
    RETURN FALSE;
  END IF;

  SELECT count(*)::INTEGER
    INTO v_confirmed_count
  FROM public.arrival_items
  WHERE shop_id = p_shop_id
    AND batch_id = v_batch.id
    AND status = 'confirmed';

  IF coalesce(v_confirmed_count, 0) = 0 THEN
    RETURN FALSE;
  END IF;

  SELECT coalesce(array_agg(DISTINCT product_id) FILTER (WHERE product_id IS NOT NULL), ARRAY[]::BIGINT[])
    INTO v_product_ids
  FROM public.arrival_items
  WHERE shop_id = p_shop_id
    AND batch_id = v_batch.id
    AND status = 'confirmed';

  IF array_length(v_product_ids, 1) IS NOT NULL THEN
    DELETE FROM public.shipping_fees
    WHERE shop_id = p_shop_id
      AND batch_id = v_batch.id
      AND batch_name = v_batch.name
      AND delivery_id IS NULL
      AND product_id = ANY(v_product_ids);
  END IF;

  WITH confirmed_arrivals AS (
    SELECT DISTINCT batch_product_id, product_id
    FROM public.arrival_items
    WHERE shop_id = p_shop_id
      AND batch_id = v_batch.id
      AND status = 'confirmed'
      AND batch_product_id IS NOT NULL
      AND product_id IS NOT NULL
  ),
  active_allocations AS (
    SELECT order_item_id, sum(adjusted_quantity)::INTEGER AS adjusted_quantity
    FROM public.damage_order_allocations
    WHERE shop_id = p_shop_id
      AND batch_id = v_batch.id
      AND is_active = TRUE
      AND order_item_id IS NOT NULL
    GROUP BY order_item_id
  ),
  order_rows AS (
    SELECT
      orders.customer_id AS client_id,
      order_items.product_id,
      coalesce(products.name, 'Item') AS product_name,
      CASE
        WHEN active_allocations.order_item_id IS NOT NULL THEN coalesce(active_allocations.adjusted_quantity, 0)
        ELSE coalesce(order_items.quantity, 0)
      END AS effective_quantity
    FROM public.order_items
    JOIN public.orders
      ON orders.id = order_items.order_id
     AND orders.shop_id = p_shop_id
     AND orders.batch_id = v_batch.id
    JOIN confirmed_arrivals
      ON confirmed_arrivals.batch_product_id = order_items.batch_product_id
    LEFT JOIN active_allocations
      ON active_allocations.order_item_id = order_items.id
    LEFT JOIN public.products
      ON products.id = order_items.product_id
     AND products.shop_id = p_shop_id
    WHERE order_items.shop_id = p_shop_id
      AND orders.customer_id IS NOT NULL
      AND order_items.product_id IS NOT NULL
  )
  INSERT INTO public.shipping_fees (
    shop_id,
    batch_id,
    batch_name,
    client_id,
    product_id,
    product_name,
    quantity,
    fee
  )
  SELECT
    p_shop_id,
    v_batch.id,
    v_batch.name,
    client_id,
    product_id,
    product_name,
    sum(effective_quantity)::INTEGER,
    0
  FROM order_rows
  GROUP BY client_id, product_id, product_name
  HAVING sum(effective_quantity) > 0;

  WITH confirmed_arrivals AS (
    SELECT product_id, coalesce(max(products.name), 'Item') AS product_name, sum(coalesce(confirmed_qty, 0))::INTEGER AS quantity
    FROM public.arrival_items
    LEFT JOIN public.products
      ON products.id = arrival_items.product_id
     AND products.shop_id = p_shop_id
    WHERE arrival_items.shop_id = p_shop_id
      AND arrival_items.batch_id = v_batch.id
      AND arrival_items.status = 'confirmed'
      AND arrival_items.product_id IS NOT NULL
    GROUP BY product_id
  ),
  products_with_orders AS (
    SELECT DISTINCT order_items.product_id
    FROM public.order_items
    JOIN public.orders
      ON orders.id = order_items.order_id
     AND orders.shop_id = p_shop_id
     AND orders.batch_id = v_batch.id
    JOIN public.arrival_items
      ON arrival_items.shop_id = p_shop_id
     AND arrival_items.batch_id = v_batch.id
     AND arrival_items.status = 'confirmed'
     AND arrival_items.batch_product_id = order_items.batch_product_id
    WHERE order_items.shop_id = p_shop_id
      AND order_items.product_id IS NOT NULL
  )
  INSERT INTO public.shipping_fees (
    shop_id,
    batch_id,
    batch_name,
    client_id,
    product_id,
    product_name,
    quantity,
    fee
  )
  SELECT
    p_shop_id,
    v_batch.id,
    v_batch.name,
    NULL,
    confirmed_arrivals.product_id,
    confirmed_arrivals.product_name,
    confirmed_arrivals.quantity,
    0
  FROM confirmed_arrivals
  WHERE confirmed_arrivals.quantity > 0
    AND NOT EXISTS (
      SELECT 1
      FROM products_with_orders
      WHERE products_with_orders.product_id = confirmed_arrivals.product_id
    );

  WITH tracking_rows AS (
    SELECT DISTINCT batch_product_id, product_id
    FROM public.arrival_items
    WHERE shop_id = p_shop_id
      AND batch_id = v_batch.id
      AND status = 'confirmed'
      AND batch_product_id IS NOT NULL
      AND product_id IS NOT NULL
  )
  UPDATE public.product_tracking tracking
  SET product_id = tracking_rows.product_id
  FROM tracking_rows
  WHERE tracking.shop_id = p_shop_id
    AND tracking.batch_id = v_batch.id
    AND tracking.batch_product_id = tracking_rows.batch_product_id;

  WITH tracking_rows AS (
    SELECT DISTINCT batch_product_id, product_id
    FROM public.arrival_items
    WHERE shop_id = p_shop_id
      AND batch_id = v_batch.id
      AND status = 'confirmed'
      AND batch_product_id IS NOT NULL
      AND product_id IS NOT NULL
  )
  INSERT INTO public.product_tracking (
    shop_id,
    batch_id,
    batch_product_id,
    product_id
  )
  SELECT
    p_shop_id,
    v_batch.id,
    tracking_rows.batch_product_id,
    tracking_rows.product_id
  FROM tracking_rows
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.product_tracking existing
    WHERE existing.shop_id = p_shop_id
      AND existing.batch_id = v_batch.id
      AND existing.batch_product_id = tracking_rows.batch_product_id
  );

  UPDATE public.arrival_items
  SET status = 'sent_to_shipping'
  WHERE shop_id = p_shop_id
    AND batch_id = v_batch.id
    AND status = 'confirmed';

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_confirmed_arrival_item_to_shipping(
  p_shop_id UUID,
  p_arrival_item_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_arrival RECORD;
  v_batch RECORD;
BEGIN
  IF p_shop_id IS NULL OR p_arrival_item_id IS NULL THEN
    RAISE EXCEPTION 'Shop and arrival item are required.';
  END IF;

  IF NOT public.has_shop_membership(p_shop_id) THEN
    RAISE EXCEPTION 'You cannot send arrivals for this shop.';
  END IF;

  SELECT id, batch_id, batch_product_id, product_id, confirmed_qty, status
    INTO v_arrival
  FROM public.arrival_items
  WHERE shop_id = p_shop_id
    AND id = p_arrival_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_arrival.status = 'sent_to_shipping' THEN
    RETURN TRUE;
  END IF;

  IF v_arrival.status <> 'confirmed' THEN
    RETURN FALSE;
  END IF;

  SELECT id, name, status, arrivals_sent
    INTO v_batch
  FROM public.batches
  WHERE shop_id = p_shop_id
    AND id = v_arrival.batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF coalesce(v_batch.status, 'open') <> 'closed' OR coalesce(v_batch.arrivals_sent, FALSE) <> TRUE THEN
    RETURN FALSE;
  END IF;

  IF v_arrival.product_id IS NOT NULL THEN
    DELETE FROM public.shipping_fees
    WHERE shop_id = p_shop_id
      AND batch_id = v_batch.id
      AND batch_name = v_batch.name
      AND delivery_id IS NULL
      AND product_id = v_arrival.product_id;
  END IF;

  WITH active_allocations AS (
    SELECT order_item_id, sum(adjusted_quantity)::INTEGER AS adjusted_quantity
    FROM public.damage_order_allocations
    WHERE shop_id = p_shop_id
      AND batch_id = v_batch.id
      AND is_active = TRUE
      AND order_item_id IS NOT NULL
    GROUP BY order_item_id
  ),
  order_rows AS (
    SELECT
      orders.customer_id AS client_id,
      order_items.product_id,
      coalesce(products.name, 'Item') AS product_name,
      CASE
        WHEN active_allocations.order_item_id IS NOT NULL THEN coalesce(active_allocations.adjusted_quantity, 0)
        ELSE coalesce(order_items.quantity, 0)
      END AS effective_quantity
    FROM public.order_items
    JOIN public.orders
      ON orders.id = order_items.order_id
     AND orders.shop_id = p_shop_id
     AND orders.batch_id = v_batch.id
    LEFT JOIN active_allocations
      ON active_allocations.order_item_id = order_items.id
    LEFT JOIN public.products
      ON products.id = order_items.product_id
     AND products.shop_id = p_shop_id
    WHERE order_items.shop_id = p_shop_id
      AND order_items.batch_product_id = v_arrival.batch_product_id
      AND orders.customer_id IS NOT NULL
      AND order_items.product_id IS NOT NULL
  )
  INSERT INTO public.shipping_fees (
    shop_id,
    batch_id,
    batch_name,
    client_id,
    product_id,
    product_name,
    quantity,
    fee
  )
  SELECT
    p_shop_id,
    v_batch.id,
    v_batch.name,
    client_id,
    product_id,
    product_name,
    sum(effective_quantity)::INTEGER,
    0
  FROM order_rows
  GROUP BY client_id, product_id, product_name
  HAVING sum(effective_quantity) > 0;

  IF NOT EXISTS (
    SELECT 1
    FROM public.shipping_fees
    WHERE shop_id = p_shop_id
      AND batch_id = v_batch.id
      AND batch_name = v_batch.name
      AND delivery_id IS NULL
      AND product_id = v_arrival.product_id
  ) AND v_arrival.product_id IS NOT NULL AND coalesce(v_arrival.confirmed_qty, 0) > 0 THEN
    INSERT INTO public.shipping_fees (
      shop_id,
      batch_id,
      batch_name,
      client_id,
      product_id,
      product_name,
      quantity,
      fee
    )
    SELECT
      p_shop_id,
      v_batch.id,
      v_batch.name,
      NULL,
      v_arrival.product_id,
      coalesce(products.name, 'Item'),
      v_arrival.confirmed_qty,
      0
    FROM public.products
    WHERE products.shop_id = p_shop_id
      AND products.id = v_arrival.product_id;
  END IF;

  IF v_arrival.batch_product_id IS NOT NULL AND v_arrival.product_id IS NOT NULL THEN
    UPDATE public.product_tracking
    SET product_id = v_arrival.product_id
    WHERE shop_id = p_shop_id
      AND batch_id = v_batch.id
      AND batch_product_id = v_arrival.batch_product_id;

    IF NOT FOUND THEN
      INSERT INTO public.product_tracking (
        shop_id,
        batch_id,
        batch_product_id,
        product_id
      )
      VALUES (
        p_shop_id,
        v_batch.id,
        v_arrival.batch_product_id,
        v_arrival.product_id
      );
    END IF;
  END IF;

  UPDATE public.arrival_items
  SET status = 'sent_to_shipping'
  WHERE shop_id = p_shop_id
    AND id = p_arrival_item_id
    AND status = 'confirmed';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_paid_client_to_deliveries(
  p_shop_id UUID,
  p_batch_name TEXT,
  p_client_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch RECORD;
  v_total_fee NUMERIC := 0;
  v_paid_amount NUMERIC := 0;
  v_delivery_id BIGINT;
BEGIN
  IF p_shop_id IS NULL OR nullif(trim(coalesce(p_batch_name, '')), '') IS NULL OR p_client_id IS NULL THEN
    RAISE EXCEPTION 'Shop, batch, and client are required.';
  END IF;

  IF NOT public.has_shop_membership(p_shop_id) THEN
    RAISE EXCEPTION 'You cannot create deliveries for this shop.';
  END IF;

  SELECT id, name, status
    INTO v_batch
  FROM public.batches
  WHERE shop_id = p_shop_id
    AND name = p_batch_name
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF coalesce(v_batch.status, 'open') <> 'closed' THEN
    RETURN FALSE;
  END IF;

  SELECT coalesce(sum(coalesce(fee, 0) * coalesce(quantity, 0)), 0)
    INTO v_total_fee
  FROM public.shipping_fees
  WHERE shop_id = p_shop_id
    AND batch_id = v_batch.id
    AND batch_name = v_batch.name
    AND client_id = p_client_id
    AND delivery_id IS NULL;

  IF coalesce(v_total_fee, 0) = 0 AND NOT EXISTS (
    SELECT 1
    FROM public.shipping_fees
    WHERE shop_id = p_shop_id
      AND batch_id = v_batch.id
      AND batch_name = v_batch.name
      AND client_id = p_client_id
      AND delivery_id IS NULL
  ) THEN
    RETURN TRUE;
  END IF;

  SELECT coalesce(paid_amount, 0)
    INTO v_paid_amount
  FROM public.shipping_payments
  WHERE shop_id = p_shop_id
    AND client_id = p_client_id
    AND (
      batch_id = v_batch.id
      OR batch_name = v_batch.name
    )
  ORDER BY id
  LIMIT 1;

  IF coalesce(v_total_fee, 0) > 0 AND coalesce(v_paid_amount, 0) < v_total_fee THEN
    RETURN FALSE;
  END IF;

  SELECT id
    INTO v_delivery_id
  FROM public.deliveries
  WHERE shop_id = p_shop_id
    AND batch_id = v_batch.id
    AND batch_name = v_batch.name
    AND customer_id = p_client_id
  ORDER BY id
  LIMIT 1;

  IF v_delivery_id IS NULL THEN
    INSERT INTO public.deliveries (
      shop_id,
      batch_id,
      batch_name,
      customer_id,
      delivery_fee,
      delivery_date,
      status,
      delivery_item_status,
      notes
    )
    VALUES (
      p_shop_id,
      v_batch.id,
      v_batch.name,
      p_client_id,
      0,
      NULL,
      'pending',
      'pending',
      'Created from shipping fees'
    )
    RETURNING id INTO v_delivery_id;
  END IF;

  IF v_delivery_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.shipping_fees
  SET delivery_id = v_delivery_id
  WHERE shop_id = p_shop_id
    AND batch_id = v_batch.id
    AND batch_name = v_batch.name
    AND client_id = p_client_id
    AND delivery_id IS NULL;

  UPDATE public.shipping_payments
  SET
    delivery_id = v_delivery_id,
    batch_id = v_batch.id
  WHERE shop_id = p_shop_id
    AND client_id = p_client_id
    AND (
      batch_id = v_batch.id
      OR batch_name = v_batch.name
    );

  UPDATE public.batches
  SET delivery_status = 'pending'
  WHERE shop_id = p_shop_id
    AND id = v_batch.id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.send_confirmed_arrivals_to_shipping(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_confirmed_arrival_item_to_shipping(UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_paid_client_to_deliveries(UUID, TEXT, BIGINT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.send_confirmed_arrivals_to_shipping(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_confirmed_arrival_item_to_shipping(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_paid_client_to_deliveries(UUID, TEXT, BIGINT) TO authenticated;
