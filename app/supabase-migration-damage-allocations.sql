-- ════════════════════════════════════════════════════════════════════════════
-- Damage Order Allocations Migration
-- ════════════════════════════════════════════════════════════════════════════
-- This migration adds support for allocating damaged quantities across clients
-- when items are received with damage. Instead of marking the entire product
-- as damaged, the system now tracks which clients' orders were reduced and by
-- how much.
--
-- Run this migration after the core application is set up.
-- ════════════════════════════════════════════════════════════════════════════

-- Create damage_order_allocations table
-- Tracks how damage from an arrival item is allocated across clients, 
-- allowing users to adjust individual client quantities when damage occurs.
CREATE TABLE IF NOT EXISTS damage_order_allocations (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    batch_name TEXT NOT NULL,
    
    -- Quantities tracking
    original_quantity INTEGER NOT NULL DEFAULT 0,     -- What was originally ordered
    adjusted_quantity INTEGER NOT NULL DEFAULT 0,     -- What client receives after damage
    damaged_quantity INTEGER NOT NULL DEFAULT 0,      -- How much attributed to this client was damaged
    
    -- Reference to the damage event
    arrival_item_id INTEGER REFERENCES arrival_items(id) ON DELETE SET NULL,
    damaged_item_id INTEGER REFERENCES damaged_items(id) ON DELETE CASCADE,
    
    -- Metadata
    reason TEXT,                                        -- Damage reason (optional reference)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indices for efficient querying
CREATE INDEX IF NOT EXISTS idx_damage_allocations_product_id 
    ON damage_order_allocations(product_id);

CREATE INDEX IF NOT EXISTS idx_damage_allocations_client_id 
    ON damage_order_allocations(client_id);

CREATE INDEX IF NOT EXISTS idx_damage_allocations_batch_name 
    ON damage_order_allocations(batch_name);

CREATE INDEX IF NOT EXISTS idx_damage_allocations_arrival_item_id 
    ON damage_order_allocations(arrival_item_id);

CREATE INDEX IF NOT EXISTS idx_damage_allocations_damaged_item_id 
    ON damage_order_allocations(damaged_item_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_damage_allocations_product_batch 
    ON damage_order_allocations(product_id, batch_name);

CREATE INDEX IF NOT EXISTS idx_damage_allocations_client_batch 
    ON damage_order_allocations(client_id, batch_name);

-- Add trigger to update updated_at
CREATE TRIGGER damage_order_allocations_updated_at
    BEFORE UPDATE ON damage_order_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- Reference View: Damage Summary by Batch
-- ════════════════════════════════════════════════════════════════════════════
-- Shows aggregate damage information per product per batch
CREATE OR REPLACE VIEW damage_summary_by_batch AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    d.batch_name,
    COUNT(DISTINCT d.client_id) as affected_client_count,
    SUM(d.original_quantity) as total_original_qty,
    SUM(d.adjusted_quantity) as total_adjusted_qty,
    SUM(d.damaged_quantity) as total_damaged_qty,
    COALESCE(SUM(d.damaged_quantity), 0)::INTEGER as total_damage_count
FROM damage_order_allocations d
JOIN products p ON d.product_id = p.id
GROUP BY p.id, p.name, d.batch_name;

-- ════════════════════════════════════════════════════════════════════════════
-- Reference View: Client Damage History
-- ════════════════════════════════════════════════════════════════════════════
-- Shows damage allocations per client across all batches
CREATE OR REPLACE VIEW client_damage_history AS
SELECT 
    c.id as client_id,
    c.name as client_name,
    p.id as product_id,
    p.name as product_name,
    d.batch_name,
    d.original_quantity,
    d.adjusted_quantity,
    d.damaged_quantity,
    d.reason,
    d.created_at
FROM damage_order_allocations d
JOIN customers c ON d.client_id = c.id
JOIN products p ON d.product_id = p.id
ORDER BY d.created_at DESC;

-- ════════════════════════════════════════════════════════════════════════════
-- Notes for Application Implementation
-- ════════════════════════════════════════════════════════════════════════════
-- 
-- 1. When an arrival item is confirmed with damage:
--    - Show a modal listing all clients who ordered that product
--    - Display their current order quantities
--    - Let user adjust quantities to match received amount
--    - Sum of adjusted quantities should equal received quantity
-- 
-- 2. When user confirms damage allocation:
--    - Record each client's allocation in damage_order_allocations
--    - Set damaged_quantity = original_quantity - adjusted_quantity
--    - Create a single damaged_items row for the total damage
-- 
-- 3. In Shipping Page (after damage):
--    - Query shipping_fees joined with damage_order_allocations
--    - Use adjusted_quantity if damage allocation exists
--    - Show damage badge if damaged_quantity > 0
-- 
-- 4. In Shipping Ledger:
--    - Show client's adjusted quantities
--    - Add damage indicator showing total damaged for that client
-- 
-- 5. Query Pattern for Shipping with Damage Info:
--    SELECT 
--        sf.id, sf.client_id, sf.product_id, sf.product_name,
--        COALESCE(doa.adjusted_quantity, sf.quantity) as display_quantity,
--        COALESCE(doa.damaged_quantity, 0) as damaged_count,
--        sf.fee, sf.batch_name
--    FROM shipping_fees sf
--    LEFT JOIN damage_order_allocations doa 
--        ON sf.product_id = doa.product_id 
--        AND sf.client_id = doa.client_id 
--        AND sf.batch_name = doa.batch_name
--    WHERE sf.batch_name = $1
-- 
-- ════════════════════════════════════════════════════════════════════════════
