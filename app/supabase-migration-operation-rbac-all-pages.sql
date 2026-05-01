-- Migration: Add operation-specific JSONB columns to role_permissions
-- Enables granular control over operations per page

ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS orders_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buying_list_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS arrivals_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shipping_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shipping_ledger_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stock_sales_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manage_batches_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS roles_config JSONB DEFAULT NULL;

COMMENT ON COLUMN role_permissions.orders_config IS 
'Orders page operations: canCreateOrder, canAddItemsToOrder, canDeleteOrder, canCloseBatch, canReopenBatch, canEditOrderAfterBatchClosed';

COMMENT ON COLUMN role_permissions.buying_list_config IS
'Buying List page operations: canEditQuantityOrdered, canChangeStatus, canEditAfterArrived, canAddItemToBuyingList, canSendToArrivals';

COMMENT ON COLUMN role_permissions.arrivals_config IS
'Arrivals page operations: canChangeReceivedValue, canConfirmReceivedItems, canSendToShipping';

COMMENT ON COLUMN role_permissions.shipping_config IS
'Shipping page operations: canEditShippingItem, canChangeShippingValue';

COMMENT ON COLUMN role_permissions.shipping_ledger_config IS
'Shipping Ledger operations: canAddAmountPaid, canMoveToDeliveries, canEditAmountPaidAfterMove';

COMMENT ON COLUMN role_permissions.stock_sales_config IS
'Stock Sales operations: canDeleteSale, canEditSale, canAddSale';

COMMENT ON COLUMN role_permissions.manage_batches_config IS
'Manage Batches operations: canDeleteBatch';

COMMENT ON COLUMN role_permissions.roles_config IS
'Roles page operations: canEditRole, canAddRole, canDeleteRole';
