-- ============================================================
-- Fix Foreign Key Constraints to Allow Cascade Delete
-- When a customer is deleted, all related records will cascade
-- ============================================================

-- Drop existing constraint and recreate with ON DELETE CASCADE
ALTER TABLE deliveries
DROP CONSTRAINT IF EXISTS deliveries_customer_id_fkey;

ALTER TABLE deliveries
ADD CONSTRAINT deliveries_customer_id_fkey 
FOREIGN KEY (customer_id) 
REFERENCES customers(id) 
ON DELETE CASCADE;

-- ============================================================
-- DONE! Foreign key updated to cascade delete on customer removal.
-- ============================================================
