-- WARNING: Destructive. Back up your DB before running.
BEGIN;

-- Drop view so recreation won't conflict
DROP VIEW IF EXISTS shipping_ledger_totals;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items') THEN
    EXECUTE 'TRUNCATE TABLE order_items RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    EXECUTE 'TRUNCATE TABLE orders RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_batches') THEN
    EXECUTE 'TRUNCATE TABLE order_batches RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buying_list') THEN
    EXECUTE 'TRUNCATE TABLE buying_list RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'arrivals') THEN
    EXECUTE 'TRUNCATE TABLE arrivals RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'arrival_items') THEN
    EXECUTE 'TRUNCATE TABLE arrival_items RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_fees') THEN
    EXECUTE 'TRUNCATE TABLE shipping_fees RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_payments') THEN
    EXECUTE 'TRUNCATE TABLE shipping_payments RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_batches') THEN
    EXECUTE 'TRUNCATE TABLE shipping_batches RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deliveries') THEN
    EXECUTE 'TRUNCATE TABLE deliveries RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'damages') THEN
    EXECUTE 'TRUNCATE TABLE damages RESTART IDENTITY CASCADE';
  END IF;
END$$;

COMMIT;
