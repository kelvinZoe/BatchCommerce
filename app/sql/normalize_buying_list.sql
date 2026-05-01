-- Normalize buying_list: merge duplicate rows (product_id, batch_name)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT COALESCE(product_id,0) AS product_id, COALESCE(batch_name,'') AS batch_name,
           SUM(COALESCE(requested_quantity,0)) AS requested_sum,
           SUM(COALESCE(ordered_quantity,0)) AS ordered_sum,
           SUM(COALESCE(quantity_arrived,0)) AS arrived_sum,
           SUM(COALESCE(order_count,0)) AS order_count_sum,
           MIN(id) AS keep_id
    FROM buying_list
    GROUP BY COALESCE(product_id,0), COALESCE(batch_name,'')
    HAVING COUNT(*) > 1
  LOOP
    -- update the row we'll keep with aggregated values
    UPDATE buying_list
    SET requested_quantity = rec.requested_sum,
        ordered_quantity = rec.ordered_sum,
        quantity_arrived = rec.arrived_sum,
        order_count = rec.order_count_sum
    WHERE id = rec.keep_id;

    -- delete duplicates
    DELETE FROM buying_list
    WHERE COALESCE(product_id,0) = rec.product_id
      AND COALESCE(batch_name,'') = rec.batch_name
      AND id <> rec.keep_id;
  END LOOP;

  -- create unique index to prevent future duplicates
  CREATE UNIQUE INDEX IF NOT EXISTS idx_buying_list_product_batch_unique ON buying_list(product_id, batch_name);
END$$;
