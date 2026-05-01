-- Aggregated view for shipping ledger totals by client and batch
-- Drop existing view first to avoid column rename errors when
-- replacing delivery_id -> client_id column names.
DROP VIEW IF EXISTS shipping_ledger_totals;
CREATE VIEW shipping_ledger_totals AS
SELECT
  d.client_id AS client_id,
  COALESCE(c.name, CONCAT('Client ', d.client_id)) AS client_name,
  f.batch_name AS batch_name,
  SUM(f.fee) AS total_fee,
  COALESCE(SUM(sp.paid_amount), 0) AS total_paid,
  (SUM(f.fee) - COALESCE(SUM(sp.paid_amount), 0)) AS balance,
  CASE
    WHEN COALESCE(SUM(sp.paid_amount), 0) >= SUM(f.fee) THEN 'paid'
    WHEN COALESCE(SUM(sp.paid_amount), 0) > 0 THEN 'partial'
    ELSE 'unpaid'
  END AS status
FROM shipping_fees f
LEFT JOIN deliveries d ON d.id = f.delivery_id
LEFT JOIN clients c ON c.id = d.client_id
LEFT JOIN shipping_payments sp ON sp.delivery_id = f.delivery_id
GROUP BY d.client_id, c.name, f.batch_name;

-- Grant read to public (optional, remove if using RLS or restricted access)
-- GRANT SELECT ON shipping_ledger_totals TO public;
