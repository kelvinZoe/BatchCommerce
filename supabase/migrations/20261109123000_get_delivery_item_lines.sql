-- Deliveries store workflow state while their actual product lines remain in
-- shipping_fees. Expose only the lines assigned to deliveries a workspace user
-- is allowed to view, without granting broad shipping-ledger access.

BEGIN;

-- Repair deliveries created before the workflow consistently wrote
-- shipping_fees.delivery_id. A fee is linked only when its shop, batch and
-- customer identify an existing delivery.
UPDATE public.shipping_fees AS fee
SET delivery_id = matched.delivery_id,
    updated_at = now()
FROM (
  SELECT fee_row.id AS fee_id, min(delivery.id) AS delivery_id
  FROM public.shipping_fees AS fee_row
  JOIN public.deliveries AS delivery
    ON delivery.shop_id = fee_row.shop_id
   AND delivery.batch_id = fee_row.batch_id
   AND delivery.customer_id = fee_row.client_id
  WHERE fee_row.delivery_id IS NULL
  GROUP BY fee_row.id
) AS matched
WHERE fee.id = matched.fee_id;

CREATE OR REPLACE FUNCTION public.get_delivery_item_lines(
  p_shop_id UUID,
  p_batch_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
  delivery_id BIGINT,
  product_id BIGINT,
  product_name TEXT,
  quantity INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_shop_permission(p_shop_id, 'deliveries', 'view')
     AND NOT public.has_shop_permission(p_shop_id, 'shipping', 'view') THEN
    RAISE EXCEPTION 'You do not have permission to view deliveries for this shop.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    fee.delivery_id,
    fee.product_id,
    fee.product_name,
    fee.quantity
  FROM public.shipping_fees AS fee
  JOIN public.deliveries AS delivery
    ON delivery.id = fee.delivery_id
   AND delivery.shop_id = fee.shop_id
  WHERE fee.shop_id = p_shop_id
    AND fee.delivery_id IS NOT NULL
    AND (p_batch_id IS NULL OR delivery.batch_id = p_batch_id)
  ORDER BY fee.delivery_id, fee.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_delivery_item_lines(UUID, BIGINT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_item_lines(UUID, BIGINT)
  TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
