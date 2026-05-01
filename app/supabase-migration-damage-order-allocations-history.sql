-- Multishop damage allocation + order fulfillment history
-- Run this after the multishop reset/workflow migrations.

CREATE TABLE IF NOT EXISTS damage_order_allocations (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  order_item_id BIGINT REFERENCES order_items(id) ON DELETE SET NULL,
  arrival_item_id BIGINT REFERENCES arrival_items(id) ON DELETE SET NULL,
  damaged_item_id BIGINT REFERENCES damaged_items(id) ON DELETE SET NULL,
  batch_id BIGINT REFERENCES batches(id) ON DELETE CASCADE,
  batch_product_id BIGINT REFERENCES batch_products(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  client_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL DEFAULT '',
  original_quantity INTEGER NOT NULL DEFAULT 0,
  adjusted_quantity INTEGER NOT NULL DEFAULT 0,
  damaged_quantity INTEGER NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  undone_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  undone_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS damage_order_allocations
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS order_item_id BIGINT REFERENCES order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS arrival_item_id BIGINT REFERENCES arrival_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS damaged_item_id BIGINT REFERENCES damaged_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES batches(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS batch_product_id BIGINT REFERENCES batch_products(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS batch_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS original_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjusted_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS undone_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE damage_order_allocations doa
SET
  batch_id = COALESCE(doa.batch_id, b.id),
  shop_id = COALESCE(doa.shop_id, b.shop_id)
FROM batches b
WHERE doa.batch_id IS NULL
  AND doa.batch_name IS NOT NULL
  AND doa.batch_name <> ''
  AND b.name = doa.batch_name;

UPDATE damage_order_allocations doa
SET shop_id = b.shop_id
FROM arrival_items ai
JOIN batches b ON b.id = ai.batch_id
WHERE doa.shop_id IS NULL
  AND doa.arrival_item_id = ai.id;

CREATE INDEX IF NOT EXISTS idx_damage_order_allocations_shop_id
  ON damage_order_allocations(shop_id);
CREATE INDEX IF NOT EXISTS idx_damage_order_allocations_order_item_id
  ON damage_order_allocations(order_item_id);
CREATE INDEX IF NOT EXISTS idx_damage_order_allocations_arrival_item_id
  ON damage_order_allocations(arrival_item_id);
CREATE INDEX IF NOT EXISTS idx_damage_order_allocations_batch_id
  ON damage_order_allocations(batch_id);
CREATE INDEX IF NOT EXISTS idx_damage_order_allocations_batch_product_id
  ON damage_order_allocations(batch_product_id);
CREATE INDEX IF NOT EXISTS idx_damage_order_allocations_batch_name
  ON damage_order_allocations(batch_name);
CREATE INDEX IF NOT EXISTS idx_damage_order_allocations_product_client
  ON damage_order_allocations(product_id, client_id);
CREATE INDEX IF NOT EXISTS idx_damage_order_allocations_active
  ON damage_order_allocations(is_active, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_damage_order_allocations_active_order_item
  ON damage_order_allocations(order_item_id, arrival_item_id)
  WHERE is_active = true AND order_item_id IS NOT NULL;

ALTER TABLE damage_order_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read damage_order_allocations" ON damage_order_allocations;
CREATE POLICY "Authenticated can read damage_order_allocations"
  ON damage_order_allocations
  FOR SELECT
  TO authenticated
  USING (has_shop_membership(shop_id));

DROP POLICY IF EXISTS "Authenticated can insert damage_order_allocations" ON damage_order_allocations;
CREATE POLICY "Authenticated can insert damage_order_allocations"
  ON damage_order_allocations
  FOR INSERT
  TO authenticated
  WITH CHECK (has_shop_membership(shop_id));

DROP POLICY IF EXISTS "Authenticated can update damage_order_allocations" ON damage_order_allocations;
CREATE POLICY "Authenticated can update damage_order_allocations"
  ON damage_order_allocations
  FOR UPDATE
  TO authenticated
  USING (has_shop_membership(shop_id))
  WITH CHECK (has_shop_membership(shop_id));

DROP TRIGGER IF EXISTS trg_damage_order_allocations_updated ON damage_order_allocations;
CREATE TRIGGER trg_damage_order_allocations_updated
  BEFORE UPDATE ON damage_order_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_damage_order_allocations_shop ON damage_order_allocations;
CREATE TRIGGER trg_damage_order_allocations_shop
  BEFORE INSERT OR UPDATE ON damage_order_allocations
  FOR EACH ROW EXECUTE FUNCTION set_shop_fields();

DROP TRIGGER IF EXISTS trg_damage_order_allocations_actor ON damage_order_allocations;
CREATE TRIGGER trg_damage_order_allocations_actor
  BEFORE INSERT OR UPDATE ON damage_order_allocations
  FOR EACH ROW EXECUTE FUNCTION set_actor_fields();

DROP TRIGGER IF EXISTS trg_damage_order_allocations_audit ON damage_order_allocations;
CREATE TRIGGER trg_damage_order_allocations_audit
  AFTER INSERT OR UPDATE OR DELETE ON damage_order_allocations
  FOR EACH ROW EXECUTE FUNCTION audit_log_write();
