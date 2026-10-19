-- Let customers use a WhatsApp username and let orders draw products directly
-- from the shop catalogue while retaining batch_products as the workflow anchor.

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS whatsapp_username TEXT NOT NULL DEFAULT '';

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS preorder_discount_min_qty INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS preorder_discount_price NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Existing shops previously kept preorder defaults only on each batch row.
-- Seed empty catalogue defaults from the most recently updated batch product.
WITH latest_batch_pricing AS (
  SELECT DISTINCT ON (batch_product.shop_id, batch_product.product_id)
    batch_product.shop_id,
    batch_product.product_id,
    batch_product.preorder_price,
    batch_product.preorder_discount_min_qty,
    batch_product.preorder_discount_price
  FROM public.batch_products AS batch_product
  ORDER BY
    batch_product.shop_id,
    batch_product.product_id,
    COALESCE(batch_product.updated_at, batch_product.created_at) DESC,
    batch_product.id DESC
)
UPDATE public.products AS product
SET
  preorder_price = CASE
    WHEN COALESCE(product.preorder_price, 0) = 0 THEN latest.preorder_price
    ELSE product.preorder_price
  END,
  preorder_discount_min_qty = CASE
    WHEN COALESCE(product.preorder_discount_min_qty, 0) = 0 THEN latest.preorder_discount_min_qty
    ELSE product.preorder_discount_min_qty
  END,
  preorder_discount_price = CASE
    WHEN COALESCE(product.preorder_discount_price, 0) = 0 THEN latest.preorder_discount_price
    ELSE product.preorder_discount_price
  END
FROM latest_batch_pricing AS latest
WHERE latest.shop_id = product.shop_id
  AND latest.product_id = product.id;

CREATE OR REPLACE FUNCTION public.ensure_batch_product_for_order(
  p_shop_id UUID,
  p_batch_id BIGINT,
  p_product_id BIGINT
)
RETURNS public.batch_products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_batch_product public.batch_products%ROWTYPE;
BEGIN
  IF NOT public.has_shop_membership(p_shop_id) THEN
    RAISE EXCEPTION 'You do not have access to this shop.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.batches AS batch
    WHERE batch.id = p_batch_id
      AND batch.shop_id = p_shop_id
      AND batch.status = 'open'
  ) THEN
    RAISE EXCEPTION 'The selected batch is unavailable or closed.' USING ERRCODE = 'P0001';
  END IF;

  SELECT product.*
  INTO v_product
  FROM public.products AS product
  WHERE product.id = p_product_id
    AND product.shop_id = p_shop_id
    AND COALESCE(product.is_active, TRUE) = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected product is unavailable.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_shop_id::TEXT || ':' || p_batch_id::TEXT || ':' || p_product_id::TEXT, 0)
  );

  SELECT batch_product.*
  INTO v_batch_product
  FROM public.batch_products AS batch_product
  WHERE batch_product.shop_id = p_shop_id
    AND batch_product.batch_id = p_batch_id
    AND batch_product.product_id = p_product_id
  ORDER BY batch_product.id
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN v_batch_product;
  END IF;

  INSERT INTO public.batch_products (
    shop_id,
    batch_id,
    product_id,
    preorder_price,
    preorder_discount_min_qty,
    preorder_discount_price,
    stock_price,
    stock_discount_min_qty,
    stock_discount_price,
    in_stock_qty
  )
  VALUES (
    p_shop_id,
    p_batch_id,
    p_product_id,
    COALESCE(v_product.preorder_price, 0),
    COALESCE(v_product.preorder_discount_min_qty, 0),
    COALESCE(v_product.preorder_discount_price, 0),
    COALESCE(v_product.stock_price, 0),
    COALESCE(v_product.stock_discount_min_qty, 0),
    COALESCE(v_product.stock_discount_price, 0),
    COALESCE(v_product.stock, 0)
  )
  RETURNING * INTO v_batch_product;

  IF v_batch_product.shop_id <> p_shop_id THEN
    RAISE EXCEPTION 'The batch product belongs to another shop.' USING ERRCODE = '42501';
  END IF;

  RETURN v_batch_product;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_batch_product_for_order(UUID, BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_batch_product_for_order(UUID, BIGINT, BIGINT) TO authenticated;

NOTIFY pgrst, 'reload schema';
