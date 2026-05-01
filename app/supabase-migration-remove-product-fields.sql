-- ============================================================
-- Shakhis Commerce – Remove local_price & in_stock from products
-- Run this in the Supabase SQL Editor
-- ============================================================

ALTER TABLE products DROP COLUMN IF EXISTS local_price;
ALTER TABLE products DROP COLUMN IF EXISTS in_stock;

-- ╔═══════════════════════════════════════════════════════╗
-- ║  DONE! local_price and in_stock removed from products ║
-- ╚═══════════════════════════════════════════════════════╝
