-- Migration: drop delivery_fee from orders (we now attach fees to deliveries)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_fee'
  ) THEN
    ALTER TABLE orders DROP COLUMN delivery_fee;
  END IF;
END$$;
