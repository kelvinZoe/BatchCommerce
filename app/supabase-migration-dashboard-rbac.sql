-- Migration: Add dashboard_config JSONB to role_permissions
-- This enables per-role control over which dashboard sections are visible.
-- Only the row where resource = 'dashboard' will use this column.

ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS dashboard_config JSONB DEFAULT NULL;

COMMENT ON COLUMN role_permissions.dashboard_config IS
'Per-role dashboard section visibility flags. Only populated for resource=''dashboard'' rows.
Boolean keys: stats, finance, revenueTrend, topProducts, deliveryOverview,
batchPipeline, recentOrders, expenses, stockSales, damagedItems, inventory.
NULL = all hidden (default for non-admin roles).
Admin role ignores this column and always sees all sections.';
