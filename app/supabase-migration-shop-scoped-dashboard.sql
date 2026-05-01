-- Shop scoping fixes for legacy dashboard tables

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'arrivals'
  ) THEN
    ALTER TABLE arrivals
      ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;

    UPDATE arrivals a
    SET shop_id = b.shop_id
    FROM batches b
    WHERE a.shop_id IS NULL
      AND a.batch_name = b.name;

    CREATE INDEX IF NOT EXISTS idx_arrivals_shop_id
      ON arrivals(shop_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'damage_order_allocations'
  ) THEN
    ALTER TABLE damage_order_allocations
      ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;

    UPDATE damage_order_allocations d
    SET shop_id = b.shop_id
    FROM batches b
    WHERE d.shop_id IS NULL
      AND d.batch_name = b.name;

    CREATE INDEX IF NOT EXISTS idx_damage_order_allocations_shop_id
      ON damage_order_allocations(shop_id);
  END IF;
END $$;
