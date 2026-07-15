-- Move product catalog cascade deletion into a single guarded database function.
-- This keeps related cleanup transactional and ensures callers can only delete
-- products that belong to a shop they can access.

CREATE OR REPLACE FUNCTION public.delete_product_catalog_cascade(
  p_shop_id UUID,
  p_product_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id BIGINT;
BEGIN
  IF p_shop_id IS NULL OR p_product_id IS NULL THEN
    RAISE EXCEPTION 'Shop and product are required.';
  END IF;

  IF NOT public.has_shop_membership(p_shop_id) THEN
    RAISE EXCEPTION 'You cannot delete products for this shop.';
  END IF;

  SELECT id
    INTO v_product_id
  FROM public.products
  WHERE id = p_product_id
    AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.damage_order_allocations
  WHERE shop_id = p_shop_id
    AND product_id = p_product_id;

  DELETE FROM public.shipping_fees
  WHERE shop_id = p_shop_id
    AND product_id = p_product_id;

  DELETE FROM public.order_items
  WHERE shop_id = p_shop_id
    AND product_id = p_product_id;

  DELETE FROM public.stock_sale_items
  WHERE shop_id = p_shop_id
    AND product_id = p_product_id;

  DELETE FROM public.shipping_invoice_items
  WHERE shop_id = p_shop_id
    AND product_id = p_product_id;

  DELETE FROM public.product_tracking
  WHERE shop_id = p_shop_id
    AND product_id = p_product_id;

  DELETE FROM public.batch_product_shipping
  WHERE shop_id = p_shop_id
    AND product_id = p_product_id;

  DELETE FROM public.follow_ups
  WHERE shop_id = p_shop_id
    AND product_id = p_product_id;

  DELETE FROM public.damaged_items
  WHERE shop_id = p_shop_id
    AND product_id = p_product_id;

  DELETE FROM public.arrival_items
  WHERE shop_id = p_shop_id
    AND product_id = p_product_id;

  DELETE FROM public.buying_list
  WHERE shop_id = p_shop_id
    AND product_id = p_product_id;

  DELETE FROM public.batch_products
  WHERE shop_id = p_shop_id
    AND product_id = p_product_id;

  DELETE FROM public.products
  WHERE shop_id = p_shop_id
    AND id = p_product_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_product_catalog_cascade(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_product_catalog_cascade(UUID, BIGINT) TO authenticated;
