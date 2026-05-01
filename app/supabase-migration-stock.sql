  -- Add inventory stock to products
  ALTER TABLE products
    ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

  -- Track source of buying list items (client vs shop)
  ALTER TABLE buying_list
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'client';

  -- Prevent double stock application when batches arrive
  ALTER TABLE order_batches
    ADD COLUMN IF NOT EXISTS stock_applied BOOLEAN NOT NULL DEFAULT FALSE;

  -- Add purchase_price to products (migrate from shipping_fee if present)
  ALTER TABLE products
    ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2) NOT NULL DEFAULT 0;

  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'shipping_fee'
    ) THEN
      -- Copy existing shipping_fee into purchase_price for existing rows
      EXECUTE 'UPDATE products SET purchase_price = COALESCE(shipping_fee, 0) WHERE purchase_price = 0';

      -- Remove old column now that data has been migrated
      EXECUTE 'ALTER TABLE products DROP COLUMN IF EXISTS shipping_fee';
    END IF;
  END$$;
