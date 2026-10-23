-- Change several pending buying-list rows to the same next status atomically.
-- The source status is deliberately fixed to pending so this bulk convenience
-- cannot overwrite workflow progress on ordered, shipped, or arrived items.

CREATE OR REPLACE FUNCTION public.bulk_update_buying_list_status(
  p_shop_id UUID,
  p_batch_id BIGINT,
  p_item_ids BIGINT[],
  p_target_status TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_requested_count INTEGER;
  v_matching_count INTEGER;
  v_updated_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before changing buying-list items.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_shop_permission(p_shop_id, 'buying_list', 'edit') THEN
    RAISE EXCEPTION 'You do not have permission to change this buying list.' USING ERRCODE = '42501';
  END IF;

  IF p_target_status NOT IN ('ordered', 'shipped', 'arrived') THEN
    RAISE EXCEPTION 'Pending items can only be changed to ordered, shipped, or arrived.' USING ERRCODE = '22023';
  END IF;

  v_requested_count := COALESCE(cardinality(p_item_ids), 0);
  IF v_requested_count = 0 THEN
    RAISE EXCEPTION 'Select at least one pending buying-list item.' USING ERRCODE = '22023';
  END IF;

  IF v_requested_count > 100 THEN
    RAISE EXCEPTION 'No more than 100 buying-list items can be changed at once.' USING ERRCODE = '22023';
  END IF;

  IF (SELECT count(DISTINCT item_id) FROM unnest(p_item_ids) AS selected(item_id)) <> v_requested_count THEN
    RAISE EXCEPTION 'The buying-list selection contains duplicate items.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.batches AS batch
    WHERE batch.id = p_batch_id
      AND batch.shop_id = p_shop_id
  ) THEN
    RAISE EXCEPTION 'Batch not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::INTEGER
  INTO v_matching_count
  FROM (
    SELECT buying_item.id
    FROM public.buying_list AS buying_item
    WHERE buying_item.shop_id = p_shop_id
      AND buying_item.batch_id = p_batch_id
      AND buying_item.id = ANY(p_item_ids)
      AND buying_item.status = 'pending'
      AND COALESCE(buying_item.moved_to_arrivals, FALSE) = FALSE
    FOR UPDATE
  ) AS locked_items;

  IF v_matching_count <> v_requested_count THEN
    RAISE EXCEPTION 'One or more selected items are unavailable or no longer pending. Refresh and try again.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.buying_list AS buying_item
  SET status = p_target_status,
      updated_at = now()
  WHERE buying_item.shop_id = p_shop_id
    AND buying_item.batch_id = p_batch_id
    AND buying_item.id = ANY(p_item_ids)
    AND buying_item.status = 'pending'
    AND COALESCE(buying_item.moved_to_arrivals, FALSE) = FALSE;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_update_buying_list_status(UUID, BIGINT, BIGINT[], TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_update_buying_list_status(UUID, BIGINT, BIGINT[], TEXT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
