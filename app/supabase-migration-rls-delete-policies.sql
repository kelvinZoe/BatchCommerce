-- ============================================================
-- Add DELETE Policies for RLS on All Tables
-- Required for batch deletion cascade to work properly
-- ============================================================

-- DELETE policies for tables involved in batch deletion

DROP POLICY IF EXISTS "Authenticated can delete batches" ON batches;
CREATE POLICY "Authenticated can delete batches" ON batches
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete products" ON products;
CREATE POLICY "Authenticated can delete products" ON products
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete batch_products" ON batch_products;
CREATE POLICY "Authenticated can delete batch_products" ON batch_products
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete orders" ON orders;
CREATE POLICY "Authenticated can delete orders" ON orders
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete order_items" ON order_items;
CREATE POLICY "Authenticated can delete order_items" ON order_items
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete buying_list" ON buying_list;
CREATE POLICY "Authenticated can delete buying_list" ON buying_list
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete arrival_items" ON arrival_items;
CREATE POLICY "Authenticated can delete arrival_items" ON arrival_items
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete damaged_items" ON damaged_items;
CREATE POLICY "Authenticated can delete damaged_items" ON damaged_items
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete follow_ups" ON follow_ups;
CREATE POLICY "Authenticated can delete follow_ups" ON follow_ups
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete product_tracking" ON product_tracking;
CREATE POLICY "Authenticated can delete product_tracking" ON product_tracking
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete batch_product_shipping" ON batch_product_shipping;
CREATE POLICY "Authenticated can delete batch_product_shipping" ON batch_product_shipping
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete shipping_invoices" ON shipping_invoices;
CREATE POLICY "Authenticated can delete shipping_invoices" ON shipping_invoices
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete shipping_invoice_items" ON shipping_invoice_items;
CREATE POLICY "Authenticated can delete shipping_invoice_items" ON shipping_invoice_items
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete deliveries" ON deliveries;
CREATE POLICY "Authenticated can delete deliveries" ON deliveries
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete stock_sales" ON stock_sales;
CREATE POLICY "Authenticated can delete stock_sales" ON stock_sales
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete stock_sale_items" ON stock_sale_items;
CREATE POLICY "Authenticated can delete stock_sale_items" ON stock_sale_items
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete customers" ON customers;
CREATE POLICY "Authenticated can delete customers" ON customers
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- DONE! DELETE policies added/updated for cascade deletion.
-- ============================================================
