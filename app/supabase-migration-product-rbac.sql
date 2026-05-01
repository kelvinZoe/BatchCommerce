-- Migration: Add product_config JSONB to role_permissions
-- This enables per-role control over what product operations are allowed.
-- Only the row where resource = 'products' will use this column.

ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS product_config JSONB DEFAULT NULL;

COMMENT ON COLUMN role_permissions.product_config IS
'Per-role product operation permission flags. Only populated for resource=''products'' rows.
Boolean keys: canAddBatch, canAddProductToBatch, canEditBatchProductPrice, canDeleteProductFromBatch.
NULL = all operations disabled (default for non-admin roles).
Admin role ignores this column and always has all product permissions.

Special Rules:
- canEditBatchProductPrice: Only admin can Edit prices (this is hard-coded, permission config is for future flexibility)
- If batch status=''closed'', only admin can Add/Edit/Delete products in that batch (status check happens in component)';
