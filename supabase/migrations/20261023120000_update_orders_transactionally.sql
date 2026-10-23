-- Edit an open-batch order and its complete item set in one transaction.
-- Closed batches are deliberately immutable because their order quantities may
-- already have produced buying-list, arrival, damage, and shipping records.

CREATE OR REPLACE FUNCTION public.update_order_with_items(
  p_shop_id UUID,
  p_order_id BIGINT,
  p_customer_id BIGINT,
  p_notes TEXT,
  p_items JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item JSONB;
  v_item_id BIGINT;
  v_product_id BIGINT;
  v_quantity INTEGER;
  v_batch_product public.batch_products%ROWTYPE;
  v_unit_price NUMERIC(12,2);
  v_subtotal NUMERIC(12,2);
  v_total NUMERIC(12,2) := 0;
  v_keep_item_ids BIGINT[] := ARRAY[]::BIGINT[];
  v_seen_product_ids BIGINT[] := ARRAY[]::BIGINT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before editing an order.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_shop_permission(p_shop_id, 'orders', 'edit') THEN
    RAISE EXCEPTION 'You do not have permission to edit orders for this shop.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.shop_has_subscription_access(p_shop_id) THEN
    RAISE EXCEPTION 'This workspace is read-only until its subscription is renewed.' USING ERRCODE = '42501';
  END IF;

  SELECT orders.*
  INTO v_order
  FROM public.orders
  JOIN public.batches
    ON batches.id = orders.batch_id
   AND batches.shop_id = orders.shop_id
  WHERE orders.id = p_order_id
    AND orders.shop_id = p_shop_id
    AND batches.status = 'open'
  FOR UPDATE OF orders;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The order is unavailable or its batch is closed.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customers
    WHERE customers.id = p_customer_id
      AND customers.shop_id = p_shop_id
  ) THEN
    RAISE EXCEPTION 'The selected customer is unavailable.' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.shop_id = p_shop_id
      AND orders.batch_id = v_order.batch_id
      AND orders.customer_id = p_customer_id
      AND orders.id <> p_order_id
  ) THEN
    RAISE EXCEPTION 'This customer already has another order in the batch.' USING ERRCODE = '23505';
  END IF;

  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'An order must contain at least one item.' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'An order cannot contain more than 100 items.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_shop_id::TEXT || ':order:' || p_order_id::TEXT, 0));

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := NULLIF(v_item ->> 'id', '')::BIGINT;
    v_product_id := NULLIF(v_item ->> 'product_id', '')::BIGINT;
    v_quantity := NULLIF(v_item ->> 'quantity', '')::INTEGER;

    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 1000000 THEN
      RAISE EXCEPTION 'Every order item needs a valid product and quantity.' USING ERRCODE = '22023';
    END IF;

    IF v_product_id = ANY(v_seen_product_ids) THEN
      RAISE EXCEPTION 'Each product can appear only once in an order.' USING ERRCODE = '22023';
    END IF;
    v_seen_product_ids := array_append(v_seen_product_ids, v_product_id);

    IF v_item_id IS NOT NULL AND v_item_id = ANY(v_keep_item_ids) THEN
      RAISE EXCEPTION 'An order item was submitted more than once.' USING ERRCODE = '22023';
    END IF;

    SELECT ensured.*
    INTO v_batch_product
    FROM public.ensure_batch_product_for_order(p_shop_id, v_order.batch_id, v_product_id) AS ensured;

    v_unit_price := CASE
      WHEN COALESCE(v_batch_product.preorder_discount_min_qty, 0) > 0
       AND v_quantity >= v_batch_product.preorder_discount_min_qty
      THEN COALESCE(NULLIF(v_batch_product.preorder_discount_price, 0), v_batch_product.preorder_price, 0)
      ELSE COALESCE(v_batch_product.preorder_price, 0)
    END;
    v_subtotal := round(v_unit_price * v_quantity, 2);

    IF v_item_id IS NOT NULL THEN
      UPDATE public.order_items
      SET product_id = v_product_id,
          batch_product_id = v_batch_product.id,
          quantity = v_quantity,
          unit_price = v_unit_price,
          subtotal = v_subtotal,
          discount_applied = COALESCE(v_batch_product.preorder_discount_min_qty, 0) > 0
            AND v_quantity >= v_batch_product.preorder_discount_min_qty,
          updated_at = now()
      WHERE order_items.id = v_item_id
        AND order_items.order_id = p_order_id
        AND order_items.shop_id = p_shop_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'An order item is unavailable or belongs to another order.' USING ERRCODE = '42501';
      END IF;
    ELSE
      INSERT INTO public.order_items (
        shop_id, order_id, batch_product_id, product_id,
        quantity, unit_price, subtotal, discount_applied
      ) VALUES (
        p_shop_id, p_order_id, v_batch_product.id, v_product_id,
        v_quantity, v_unit_price, v_subtotal,
        COALESCE(v_batch_product.preorder_discount_min_qty, 0) > 0
          AND v_quantity >= v_batch_product.preorder_discount_min_qty
      )
      RETURNING id INTO v_item_id;
    END IF;

    v_keep_item_ids := array_append(v_keep_item_ids, v_item_id);
    v_total := v_total + v_subtotal;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.order_items
    JOIN public.damage_order_allocations
      ON damage_order_allocations.order_item_id = order_items.id
     AND damage_order_allocations.is_active = TRUE
    WHERE order_items.order_id = p_order_id
      AND order_items.shop_id = p_shop_id
      AND NOT (order_items.id = ANY(v_keep_item_ids))
  ) THEN
    RAISE EXCEPTION 'A fulfilled or adjusted item cannot be removed from an order.' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.order_items
  WHERE order_items.order_id = p_order_id
    AND order_items.shop_id = p_shop_id
    AND NOT (order_items.id = ANY(v_keep_item_ids));

  UPDATE public.orders
  SET customer_id = p_customer_id,
      notes = COALESCE(p_notes, ''),
      total = v_total,
      updated_at = now()
  WHERE orders.id = p_order_id
    AND orders.shop_id = p_shop_id;

  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_with_items(UUID, BIGINT, BIGINT, TEXT, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_order_with_items(UUID, BIGINT, BIGINT, TEXT, JSONB)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
