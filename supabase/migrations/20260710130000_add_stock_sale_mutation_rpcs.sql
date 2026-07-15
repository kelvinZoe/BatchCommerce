-- Move stock-sale mutations into guarded transactional functions.
-- These functions keep sale rows, sale items, and product stock changes atomic.

CREATE OR REPLACE FUNCTION public.create_stock_sale_with_items(
  p_shop_id UUID,
  p_customer_id BIGINT,
  p_customer_name TEXT,
  p_sale_channel TEXT,
  p_total_amount NUMERIC,
  p_items JSONB
)
RETURNS TABLE (
  id BIGINT,
  sale_uuid UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id BIGINT;
  v_sale_uuid UUID;
  v_missing_products INTEGER;
BEGIN
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop is required.';
  END IF;

  IF NOT public.has_shop_membership(p_shop_id) THEN
    RAISE EXCEPTION 'You cannot create stock sales for this shop.';
  END IF;

  IF coalesce(jsonb_array_length(p_items), 0) = 0 THEN
    RAISE EXCEPTION 'At least one stock-sale item is required.';
  END IF;

  WITH parsed AS (
    SELECT DISTINCT
      coalesce(item->>'productId', item->>'product_id')::BIGINT AS product_id
    FROM jsonb_array_elements(p_items) AS item
  )
  SELECT count(*)::INTEGER
    INTO v_missing_products
  FROM parsed parsed_item
  LEFT JOIN public.products product
    ON product.id = parsed_item.product_id
   AND product.shop_id = p_shop_id
  WHERE product.id IS NULL;

  IF v_missing_products > 0 THEN
    RAISE EXCEPTION 'One or more products do not belong to this shop.';
  END IF;

  INSERT INTO public.stock_sales (
    shop_id,
    customer_id,
    customer_name,
    sale_channel,
    total_amount,
    status
  )
  VALUES (
    p_shop_id,
    p_customer_id,
    coalesce(p_customer_name, 'Walk-in'),
    coalesce(nullif(p_sale_channel, ''), 'walk_in'),
    coalesce(p_total_amount, 0),
    'open'
  )
  RETURNING stock_sales.id, stock_sales.sale_uuid
    INTO v_sale_id, v_sale_uuid;

  INSERT INTO public.stock_sale_items (
    shop_id,
    stock_sale_id,
    batch_product_id,
    product_id,
    quantity,
    unit_price,
    subtotal
  )
  SELECT
    p_shop_id,
    v_sale_id,
    coalesce(item->>'batchProductId', item->>'batch_product_id')::BIGINT,
    coalesce(item->>'productId', item->>'product_id')::BIGINT,
    coalesce((item->>'quantity')::INTEGER, 0),
    coalesce((item->>'unitPrice')::NUMERIC, (item->>'unit_price')::NUMERIC, 0),
    coalesce((item->>'subtotal')::NUMERIC, 0)
  FROM jsonb_array_elements(p_items) AS item;

  WITH quantities AS (
    SELECT
      coalesce(item->>'productId', item->>'product_id')::BIGINT AS product_id,
      sum(coalesce((item->>'quantity')::INTEGER, 0))::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY coalesce(item->>'productId', item->>'product_id')::BIGINT
  )
  UPDATE public.products product
  SET stock = greatest(0, coalesce(product.stock, 0) - quantities.quantity)
  FROM quantities
  WHERE product.shop_id = p_shop_id
    AND product.id = quantities.product_id;

  RETURN QUERY SELECT v_sale_id, v_sale_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_stock_sale_with_items(
  p_shop_id UUID,
  p_sale_id BIGINT,
  p_customer_id BIGINT,
  p_customer_name TEXT,
  p_sale_channel TEXT,
  p_total_amount NUMERIC,
  p_items JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id BIGINT;
  v_missing_products INTEGER;
BEGIN
  IF p_shop_id IS NULL OR p_sale_id IS NULL THEN
    RAISE EXCEPTION 'Shop and stock sale are required.';
  END IF;

  IF NOT public.has_shop_membership(p_shop_id) THEN
    RAISE EXCEPTION 'You cannot update stock sales for this shop.';
  END IF;

  IF coalesce(jsonb_array_length(p_items), 0) = 0 THEN
    RAISE EXCEPTION 'At least one stock-sale item is required.';
  END IF;

  SELECT stock_sales.id
    INTO v_sale_id
  FROM public.stock_sales
  WHERE id = p_sale_id
    AND shop_id = p_shop_id
    AND status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  WITH parsed AS (
    SELECT DISTINCT
      coalesce(item->>'productId', item->>'product_id')::BIGINT AS product_id
    FROM jsonb_array_elements(p_items) AS item
  )
  SELECT count(*)::INTEGER
    INTO v_missing_products
  FROM parsed parsed_item
  LEFT JOIN public.products product
    ON product.id = parsed_item.product_id
   AND product.shop_id = p_shop_id
  WHERE product.id IS NULL;

  IF v_missing_products > 0 THEN
    RAISE EXCEPTION 'One or more products do not belong to this shop.';
  END IF;

  WITH old_quantities AS (
    SELECT product_id, sum(quantity)::INTEGER AS quantity
    FROM public.stock_sale_items
    WHERE shop_id = p_shop_id
      AND stock_sale_id = p_sale_id
    GROUP BY product_id
  )
  UPDATE public.products product
  SET stock = coalesce(product.stock, 0) + old_quantities.quantity
  FROM old_quantities
  WHERE product.shop_id = p_shop_id
    AND product.id = old_quantities.product_id;

  UPDATE public.stock_sales
  SET
    customer_id = p_customer_id,
    customer_name = coalesce(p_customer_name, 'Walk-in'),
    sale_channel = coalesce(nullif(p_sale_channel, ''), 'walk_in'),
    total_amount = coalesce(p_total_amount, 0)
  WHERE shop_id = p_shop_id
    AND id = p_sale_id;

  DELETE FROM public.stock_sale_items
  WHERE shop_id = p_shop_id
    AND stock_sale_id = p_sale_id;

  INSERT INTO public.stock_sale_items (
    shop_id,
    stock_sale_id,
    batch_product_id,
    product_id,
    quantity,
    unit_price,
    subtotal
  )
  SELECT
    p_shop_id,
    p_sale_id,
    coalesce(item->>'batchProductId', item->>'batch_product_id')::BIGINT,
    coalesce(item->>'productId', item->>'product_id')::BIGINT,
    coalesce((item->>'quantity')::INTEGER, 0),
    coalesce((item->>'unitPrice')::NUMERIC, (item->>'unit_price')::NUMERIC, 0),
    coalesce((item->>'subtotal')::NUMERIC, 0)
  FROM jsonb_array_elements(p_items) AS item;

  WITH new_quantities AS (
    SELECT
      coalesce(item->>'productId', item->>'product_id')::BIGINT AS product_id,
      sum(coalesce((item->>'quantity')::INTEGER, 0))::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY coalesce(item->>'productId', item->>'product_id')::BIGINT
  )
  UPDATE public.products product
  SET stock = greatest(0, coalesce(product.stock, 0) - new_quantities.quantity)
  FROM new_quantities
  WHERE product.shop_id = p_shop_id
    AND product.id = new_quantities.product_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_stock_sale_with_stock_restore(
  p_shop_id UUID,
  p_sale_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id BIGINT;
BEGIN
  IF p_shop_id IS NULL OR p_sale_id IS NULL THEN
    RAISE EXCEPTION 'Shop and stock sale are required.';
  END IF;

  IF NOT public.has_shop_membership(p_shop_id) THEN
    RAISE EXCEPTION 'You cannot cancel stock sales for this shop.';
  END IF;

  SELECT stock_sales.id
    INTO v_sale_id
  FROM public.stock_sales
  WHERE id = p_sale_id
    AND shop_id = p_shop_id
    AND status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.stock_sales
  SET status = 'cancelled'
  WHERE shop_id = p_shop_id
    AND id = p_sale_id
    AND status = 'open';

  WITH quantities AS (
    SELECT product_id, sum(quantity)::INTEGER AS quantity
    FROM public.stock_sale_items
    WHERE shop_id = p_shop_id
      AND stock_sale_id = p_sale_id
    GROUP BY product_id
  )
  UPDATE public.products product
  SET stock = coalesce(product.stock, 0) + quantities.quantity
  FROM quantities
  WHERE product.shop_id = p_shop_id
    AND product.id = quantities.product_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_cancelled_stock_sale(
  p_shop_id UUID,
  p_sale_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id BIGINT;
BEGIN
  IF p_shop_id IS NULL OR p_sale_id IS NULL THEN
    RAISE EXCEPTION 'Shop and stock sale are required.';
  END IF;

  IF NOT public.has_shop_membership(p_shop_id) THEN
    RAISE EXCEPTION 'You cannot delete stock sales for this shop.';
  END IF;

  SELECT stock_sales.id
    INTO v_sale_id
  FROM public.stock_sales
  WHERE id = p_sale_id
    AND shop_id = p_shop_id
    AND status = 'cancelled'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.stock_sales
  WHERE shop_id = p_shop_id
    AND id = p_sale_id
    AND status = 'cancelled';

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_stock_sale_with_items(UUID, BIGINT, TEXT, TEXT, NUMERIC, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_stock_sale_with_items(UUID, BIGINT, BIGINT, TEXT, TEXT, NUMERIC, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_stock_sale_with_stock_restore(UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_cancelled_stock_sale(UUID, BIGINT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_stock_sale_with_items(UUID, BIGINT, TEXT, TEXT, NUMERIC, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_stock_sale_with_items(UUID, BIGINT, BIGINT, TEXT, TEXT, NUMERIC, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_stock_sale_with_stock_restore(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_cancelled_stock_sale(UUID, BIGINT) TO authenticated;
