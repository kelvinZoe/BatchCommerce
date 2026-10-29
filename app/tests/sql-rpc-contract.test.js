const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function compact(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function assertIncludesAll(source, values, label) {
  for (const value of values) {
    assert.match(source, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `${label} should include ${value}`);
  }
}

test('GHS 100 subscription pricing and one-month new-shop trial stay aligned', () => {
  const pricingService = read('app/src/app/services/pricing-data.service.ts');
  const flatPricingMigration = read('supabase/migrations/20260904130000_flat_monthly_subscription.sql');
  const currentPricingMigration = read('supabase/migrations/20261023133000_subscription_price_100_one_month_trial.sql');
  const edgeBilling = read('supabase/functions/_shared/billing.ts');
  const resetSchema = read('app/supabase-migration-multishop-reset.sql');
  const pricingDoc = read('PRICING_MODEL.md');

  assert.match(pricingService, /monthlyPriceGhs\s*=\s*100/);
  assert.doesNotMatch(pricingService, /monthlyLimit|recommendedPlan|overageCount/);

  assertIncludesAll(flatPricingMigration, [
    "subscription_plan = 'standard'",
    "ALTER COLUMN subscription_plan SET DEFAULT 'standard'",
    "CHECK (subscription_plan = 'standard')",
    'CHECK (plan_override IS NULL)'
  ], 'flat-pricing migration');

  assertIncludesAll(currentPricingMigration, [
    "ALTER COLUMN promo_ends_at SET DEFAULT (now() + interval '1 month')",
    'ALTER COLUMN base_amount_minor SET DEFAULT 10000',
    'CREATE OR REPLACE FUNCTION public.subscription_monthly_price_minor()',
    'SELECT 10000',
    'public.subscription_monthly_price_minor() * (100 - COALESCE(v_discount, 0))',
    'v_base_amount INTEGER := public.subscription_monthly_price_minor()',
    'Renew your GHS 100 monthly subscription'
  ], 'current subscription pricing migration');

  assert.match(resetSchema, /subscription_plan TEXT NOT NULL DEFAULT 'standard' CHECK \(subscription_plan = 'standard'\)/);
  assert.match(resetSchema, /promo_ends_at TIMESTAMPTZ NOT NULL DEFAULT \(now\(\) \+ INTERVAL '1 month'\)/i);
  assert.match(edgeBilling, /MONTHLY_PRICE_MINOR\s*=\s*10000/);
  assert.match(pricingDoc, /GHS 100 per month/);
  assert.match(pricingDoc, /one month of free access/i);
  assert.match(pricingDoc, /There are no Starter, Growth, Pro/);
  assert.doesNotMatch(pricingDoc, /GHS (150|200|300)/);
});

test('authenticated routing cannot loop when a role lacks dashboard access', () => {
  const authService = read('app/src/app/services/auth.service.ts');
  const authGuard = read('app/src/app/guards/auth.guard.ts');
  const login = read('app/src/app/pages/login/login.component.ts');
  const routes = read('app/src/app/app.routes.ts');

  assertIncludesAll(authService, [
    'getDefaultAuthenticatedRoute()',
    "firstAccessibleItem?.route || '/access-denied'",
    'if (this.sessionRestorePromise) return this.sessionRestorePromise',
    'this.restoredAuthUserId === this.currentUser.authId'
  ], 'auth service');

  assertIncludesAll(authGuard, [
    'router.createUrlTree([auth.getDefaultAuthenticatedRoute()])',
    "router.createUrlTree(['/login'])"
  ], 'auth guards');
  assert.doesNotMatch(authGuard, /router\.navigate\(\['\/dashboard'\]\)/);
  assert.match(login, /this\.authService\.getDefaultAuthenticatedRoute\(\)/);
  assert.match(routes, /path:\s*'access-denied'/);
});

test('custom roles can grant dashboard access and select dashboard sections', () => {
  const rolesComponent = read('app/src/app/pages/roles/roles.component.ts');

  assertIncludesAll(rolesComponent, [
    'DASHBOARD_COMPONENTS',
    "| 'dashboardConfig'",
    "| 'dashboard'",
    "key: 'dashboard', resource: 'dashboard', label: 'Dashboard'",
    "configKey: 'dashboardConfig'",
    'actions: this.dashboardActions'
  ], 'roles dashboard editor');
});

test('active shop members can read shared batch headers across workflow pages', () => {
  const migration = read('supabase/migrations/20261023140000_allow_members_to_read_shop_batches.sql');

  assertIncludesAll(migration, [
    'DROP POLICY IF EXISTS "Role can view batches" ON public.batches',
    'CREATE POLICY "Active shop members can read batches"',
    'FOR SELECT',
    'TO authenticated',
    'USING (public.has_shop_membership(shop_id))',
    'GRANT SELECT ON public.batches TO authenticated'
  ], 'shared batch visibility migration');

  assert.doesNotMatch(migration, /FOR (INSERT|UPDATE|DELETE)[\s\S]*has_shop_membership/i);
});

test('promo-code redemption RPC keeps commercial guardrails', () => {
  const sql = read('supabase/migrations/20260630090000_add_promo_codes.sql');

  assertIncludesAll(sql, [
    'CREATE OR REPLACE FUNCTION public.redeem_shop_promo_code',
    'SECURITY DEFINER',
    'public.has_shop_membership(p_shop_id)',
    'max_redemptions',
    'redeemed_count',
    'This promo code has already been used for this shop.',
    "subscription_status IN ('suspended', 'cancelled')",
    'REVOKE ALL ON FUNCTION public.redeem_shop_promo_code(UUID, TEXT) FROM PUBLIC',
    'GRANT EXECUTE ON FUNCTION public.redeem_shop_promo_code(UUID, TEXT) TO authenticated'
  ], 'promo-code migration');
});

test('promo-code redemption RPC qualifies columns that collide with output variables', () => {
  const sql = read('supabase/migrations/20260904120000_fix_promo_redemption_ambiguity.sql');

  assertIncludesAll(sql, [
    'CREATE OR REPLACE FUNCTION public.redeem_shop_promo_code',
    'FROM public.promo_codes AS pc',
    'FROM public.shops AS s',
    'UPDATE public.shops AS s',
    'ELSE s.promo_ends_at',
    'UPDATE public.promo_codes AS pc',
    "NOTIFY pgrst, 'reload schema'"
  ], 'promo-code ambiguity fix');
});

test('shared authentication rate limiter is atomic and service-role only', () => {
  const sql = read('supabase/migrations/20260904140000_add_shared_request_rate_limits.sql');

  assertIncludesAll(sql, [
    'CREATE SCHEMA IF NOT EXISTS private',
    'CREATE TABLE IF NOT EXISTS private.request_rate_limits',
    'PRIMARY KEY (scope, key_hash)',
    'ALTER TABLE private.request_rate_limits ENABLE ROW LEVEL SECURITY',
    'REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated',
    'CREATE OR REPLACE FUNCTION public.consume_request_rate_limit',
    'SECURITY INVOKER',
    'ON CONFLICT (scope, key_hash) DO UPDATE',
    'REVOKE ALL ON FUNCTION public.consume_request_rate_limit(TEXT, TEXT, INTEGER, INTEGER)',
    'FROM PUBLIC, anon, authenticated, service_role',
    'GRANT EXECUTE ON FUNCTION public.consume_request_rate_limit(TEXT, TEXT, INTEGER, INTEGER)',
    'TO service_role'
  ], 'shared rate-limit migration');
});

test('catalog-first orders lazily create tenant-safe batch product rows and preserve WhatsApp usernames', () => {
  const migration = read('supabase/migrations/20261019120000_catalog_first_orders_and_whatsapp_usernames.sql');
  const ordersComponent = read('app/src/app/pages/orders/orders.component.ts');
  const productService = read('app/src/app/services/product-data.service.ts');
  const clientService = read('app/src/app/services/client-data.service.ts');
  const whatsappService = read('app/src/app/services/whatsapp-link.service.ts');

  assertIncludesAll(migration, [
    'ADD COLUMN IF NOT EXISTS whatsapp_username',
    'ADD COLUMN IF NOT EXISTS preorder_discount_min_qty',
    'ADD COLUMN IF NOT EXISTS preorder_discount_price',
    'WITH latest_batch_pricing AS',
    'UPDATE public.products AS product',
    'CREATE OR REPLACE FUNCTION public.ensure_batch_product_for_order',
    'public.has_shop_membership(p_shop_id)',
    "batch.status = 'open'",
    'pg_advisory_xact_lock',
    'FROM public.batch_products AS batch_product',
    'FOR UPDATE',
    'REVOKE ALL ON FUNCTION public.ensure_batch_product_for_order',
    'GRANT EXECUTE ON FUNCTION public.ensure_batch_product_for_order'
  ], 'catalog-first order migration');

  assertIncludesAll(productService, [
    'getOrderableProducts(batchId',
    'ensureBatchProductForOrder(batchId',
    "this.sb.rpc('ensure_batch_product_for_order'"
  ], 'product data service');

  assertIncludesAll(ordersComponent, [
    'this.dbService.getOrderableProducts(batchId)',
    'attachBatchProductsToItems',
    'this.dbService.ensureBatchProductForOrder',
    'valueKey="productId"',
    'clientWhatsappUsername'
  ], 'orders component');

  assertIncludesAll(clientService, [
    'whatsapp_username',
    'normalizeWhatsappUsername'
  ], 'client data service');

  assertIncludesAll(whatsappService, [
    'https://wa.me/${normalizedUsername}',
    'includesMessage: false',
    'normalizeUsername'
  ], 'WhatsApp link service');
});

test('open-batch order editing is transactional, permission guarded, and exposed in the orders UI', () => {
  const migration = read('supabase/migrations/20261023120000_update_orders_transactionally.sql');
  const ordersComponent = read('app/src/app/pages/orders/orders.component.ts');
  const orderService = read('app/src/app/services/order-data.service.ts');
  const models = read('app/src/app/models/index.ts');

  assertIncludesAll(migration, [
    'CREATE OR REPLACE FUNCTION public.update_order_with_items',
    'SECURITY DEFINER',
    "public.has_shop_permission(p_shop_id, 'orders', 'edit')",
    'public.shop_has_subscription_access(p_shop_id)',
    "batches.status = 'open'",
    'FOR UPDATE OF orders',
    'public.ensure_batch_product_for_order',
    'Each product can appear only once in an order.',
    'DELETE FROM public.order_items',
    'UPDATE public.orders',
    'REVOKE ALL ON FUNCTION public.update_order_with_items',
    'GRANT EXECUTE ON FUNCTION public.update_order_with_items'
  ], 'order update migration');

  assertIncludesAll(models, [
    'canEditOrder: boolean',
    "key: 'canEditOrder'",
    "label: 'Edit Orders'"
  ], 'orders permission model');

  assertIncludesAll(orderService, [
    'updateOrder(order: Order)',
    "this.sb.rpc('update_order_with_items'",
    'p_items: order.items.map'
  ], 'order data service');

  assertIncludesAll(ordersComponent, [
    "id: 'edit'",
    "icon: 'pencil-square'",
    "color: 'blue'",
    'openEditOrderModal',
    'canEditOrderInSelectedBatch',
    'saveEditedOrder',
    "updated: true"
  ], 'orders page');
});

test('reopened batches discard only untouched buying-list rows before orders become editable', () => {
  const migration = read('supabase/migrations/20261023123000_harden_reopened_batch_edits.sql');
  const batchService = read('app/src/app/services/batch-data.service.ts');

  assertIncludesAll(migration, [
    'CREATE OR REPLACE FUNCTION public.enforce_order_item_batch_editable',
    'BEFORE INSERT OR UPDATE ON public.order_items',
    'This reopened batch still has workflow records',
    'CREATE OR REPLACE FUNCTION public.reopen_order_batch_safely',
    "public.has_shop_permission(p_shop_id, 'orders', 'edit')",
    "buying_list.status <> 'pending'",
    'buying_list.ordered_qty',
    'buying_list.moved_to_arrivals',
    'public.arrival_items',
    'public.shipping_invoices',
    'DELETE FROM public.buying_list',
    "order_status = 'pending'",
    "delivery_status = 'not_sent'",
    'GRANT EXECUTE ON FUNCTION public.reopen_order_batch_safely'
  ], 'safe reopen migration');

  assertIncludesAll(batchService, [
    "this.sb.rpc('reopen_order_batch_safely'",
    'p_shop_id: this.requireActiveShopId()',
    'p_batch_id: batchId'
  ], 'batch data service');
});

test('buying-list bulk status changes are atomic and limited to pending rows', () => {
  const migration = read('supabase/migrations/20261023130000_bulk_update_buying_list_status.sql');
  const service = read('app/src/app/services/database.service.ts');
  const component = read('app/src/app/pages/buying-list/buying-list.component.ts');

  assertIncludesAll(migration, [
    'CREATE OR REPLACE FUNCTION public.bulk_update_buying_list_status',
    "public.has_shop_permission(p_shop_id, 'buying_list', 'edit')",
    "p_target_status NOT IN ('ordered', 'shipped', 'arrived')",
    "buying_item.status = 'pending'",
    'FOR UPDATE',
    'v_matching_count <> v_requested_count',
    'GET DIAGNOSTICS v_updated_count = ROW_COUNT',
    'GRANT EXECUTE ON FUNCTION public.bulk_update_buying_list_status'
  ], 'bulk buying-list status migration');

  assertIncludesAll(service, [
    'bulkUpdateBuyingListStatus(',
    "this.sb.rpc('bulk_update_buying_list_status'",
    'p_shop_id: this.requireActiveShopId()',
    'p_item_ids: itemIds',
    'p_target_status: targetStatus'
  ], 'buying-list data service');

  assertIncludesAll(component, [
    'selectedPendingCount',
    'bulkTargetStatus',
    'applyBulkStatus()',
    'bulkUpdateBuyingListStatus('
  ], 'buying-list bulk status UI');
});

test('subscription billing ledger is tenant-safe, idempotent, and entitlement based', () => {
  const migration = read('supabase/migrations/20261022120000_subscription_billing_foundation.sql');

  assertIncludesAll(migration, [
    'CREATE TABLE IF NOT EXISTS public.subscription_payments',
    'CREATE TABLE IF NOT EXISTS public.subscription_entitlements',
    'CREATE TABLE IF NOT EXISTS public.subscription_provider_events',
    'CREATE TABLE IF NOT EXISTS public.subscription_reminder_deliveries',
    'CREATE TABLE IF NOT EXISTS public.platform_admins',
    'CREATE TABLE IF NOT EXISTS public.platform_action_audit',
    'CREATE OR REPLACE FUNCTION public.compute_shop_subscription_summary',
    'CREATE OR REPLACE FUNCTION public.get_shop_subscription_summary',
    'CREATE OR REPLACE FUNCTION public.can_shop_create_sales_record',
    'CREATE OR REPLACE FUNCTION public.create_subscription_payment',
    'CREATE OR REPLACE FUNCTION public.apply_subscription_payment',
    'CREATE OR REPLACE FUNCTION public.review_manual_subscription_payment',
    "public.has_shop_permission(p_shop_id, 'billing', 'view')",
    "now() + interval '1 month'",
    "now() + interval '1 month 3 days'",
    "'launch-transition:' || shop.id::TEXT",
    "lower(auth_user.email) = 'zoeinventions@gmail.com'",
    'REVOKE ALL ON FUNCTION public.apply_subscription_payment',
    'GRANT EXECUTE ON FUNCTION public.apply_subscription_payment',
    'GRANT SELECT ON public.platform_admins TO authenticated',
    'GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_provider_events TO service_role',
    'GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_reminder_deliveries TO service_role',
    'GRANT USAGE, SELECT ON SEQUENCE public.damage_order_allocations_id_seq TO authenticated',
    'GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO service_role',
    'TO service_role'
  ], 'subscription billing migration');

  assert.match(migration, /UNIQUE[\s\S]*provider_reference|subscription_payments_provider_reference_key/i);
  assert.match(migration, /UNIQUE \(shop_id, reminder_key, access_ends_at, recipient_email\)/i);
  assert.match(migration, /IF NOT public\.shop_has_subscription_access\(NEW\.shop_id\)/i);
  assert.doesNotMatch(migration, /GRANT (INSERT|UPDATE|DELETE)[\s\S]{0,80}subscription_payments[\s\S]{0,80}authenticated/i);
});

test('subscription Edge Functions keep Paystack secrets and activation on the server', () => {
  const initialize = read('supabase/functions/billing-initialize/index.ts');
  const verify = read('supabase/functions/billing-verify/index.ts');
  const webhook = read('supabase/functions/paystack-webhook/index.ts');
  const paystack = read('supabase/functions/_shared/paystack.ts');
  const manual = read('supabase/functions/manual-payment-submit/index.ts');
  const admin = read('supabase/functions/platform-admin/index.ts');

  assertIncludesAll(initialize, [
    "requireShopPermission(context, shopId, 'create')",
    "consumeRateLimit(context, 'billing_initialize'",
    "context.admin.rpc('create_subscription_payment'",
    'authorizationUrl'
  ], 'payment initializer');
  assertIncludesAll(verify, [
    'verifyAndApplyPaystackPayment',
    "requireShopPermission(context, payment.shop_id, 'view')",
    "consumeRateLimit(context, 'billing_verify'"
  ], 'payment verifier');
  assertIncludesAll(webhook, [
    "request.headers.get('x-paystack-signature')",
    'verifyPaystackSignature',
    'verifyAndApplyPaystackPayment',
    "event?.event === 'refund.processed'",
    "status: 'refunded'"
  ], 'Paystack webhook');
  assertIncludesAll(paystack, [
    "requiredEnv('PAYSTACK_SECRET_KEY')",
    "hash: 'SHA-512'",
    "currency: 'GHS'",
    "channels: ['card', 'mobile_money']"
  ], 'Paystack client');
  assertIncludesAll(manual, [
    "requireShopPermission(context, shopId, 'create')",
    "consumeRateLimit(context, 'manual_payment'",
    "p_source: 'manual'"
  ], 'manual payment endpoint');
  assertIncludesAll(admin, ['requirePlatformAdmin(context)', 'platform_action_audit'], 'platform admin endpoint');

  const browserFiles = [
    read('app/src/app/services/billing-data.service.ts'),
    read('app/src/app/pages/subscription/subscription.component.ts')
  ].join('\n');
  assert.doesNotMatch(browserFiles, /PAYSTACK_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
});

test('billing UI uses dedicated permissions and isolates the platform console', () => {
  const models = read('app/src/app/models/index.ts');
  const routes = read('app/src/app/app.routes.ts');
  const guard = read('app/src/app/guards/auth.guard.ts');
  const shell = read('app/src/app/app.component.ts');
  const subscription = read('app/src/app/pages/subscription/subscription.component.ts');

  assertIncludesAll(models, [
    "| 'billing'",
    "resource: 'billing'",
    'SubscriptionSummary',
    'SubscriptionPayment'
  ], 'billing models');
  assertIncludesAll(routes, [
    "permissionGuard('billing')",
    "path: 'platform-admin'",
    'platformAdminGuard'
  ], 'billing routes');
  assertIncludesAll(guard, ['platformAdminGuard', 'billing.isPlatformAdmin()'], 'platform admin guard');
  assertIncludesAll(shell, ['!isPlatformAdminRoute', '<app-subscription-banner>'], 'application shell');
  assertIncludesAll(subscription, ['initializePayment()', 'verifyPayment(reference)', 'submitManualPayment(input)'], 'subscription page');

  const platformAdmin = read('app/src/app/pages/platform-admin/platform-admin.component.html');
  const platformAdminComponent = read('app/src/app/pages/platform-admin/platform-admin.component.ts');
  assertIncludesAll(platformAdmin, [
    'Standard renewal is GHS 100 per month',
    "nextChargeGhs(shop) | number:'1.2-2'"
  ], 'platform admin pricing UI');
  assert.match(platformAdminComponent, /nextAmountMinor\s*\?\?\s*10000/);
});

test('product delete cascade RPC is tenant guarded and deletes all dependent product rows transactionally', () => {
  const sql = read('supabase/migrations/20260710120000_add_product_delete_cascade_rpc.sql');
  const normalized = compact(sql);

  assertIncludesAll(sql, [
    'CREATE OR REPLACE FUNCTION public.delete_product_catalog_cascade',
    'SECURITY DEFINER',
    'public.has_shop_membership(p_shop_id)',
    'FOR UPDATE',
    'REVOKE ALL ON FUNCTION public.delete_product_catalog_cascade(UUID, BIGINT) FROM PUBLIC',
    'GRANT EXECUTE ON FUNCTION public.delete_product_catalog_cascade(UUID, BIGINT) TO authenticated'
  ], 'product delete migration');

  assertIncludesAll(sql, [
    'public.damage_order_allocations',
    'public.shipping_fees',
    'public.order_items',
    'public.stock_sale_items',
    'public.shipping_invoice_items',
    'public.product_tracking',
    'public.batch_product_shipping',
    'public.follow_ups',
    'public.damaged_items',
    'public.arrival_items',
    'public.buying_list',
    'public.batch_products',
    'public.products'
  ], 'product delete migration');

  assert.match(normalized, /DELETE FROM public\.products WHERE shop_id = p_shop_id AND id = p_product_id/i);
});

test('batch delete cascade RPC preserves products and removes batch workflow rows', () => {
  const sql = read('supabase/migrations/20260710123000_add_batch_delete_cascade_rpc.sql');

  assertIncludesAll(sql, [
    'CREATE OR REPLACE FUNCTION public.delete_batch_cascade',
    'RETURNS TABLE',
    'batch_name TEXT',
    'SECURITY DEFINER',
    'public.has_shop_membership(p_shop_id)',
    'FOR UPDATE',
    'REVOKE ALL ON FUNCTION public.delete_batch_cascade(UUID, BIGINT) FROM PUBLIC',
    'GRANT EXECUTE ON FUNCTION public.delete_batch_cascade(UUID, BIGINT) TO authenticated'
  ], 'batch delete migration');

  assertIncludesAll(sql, [
    'public.stock_sale_items',
    'public.shipping_invoice_items',
    'public.shipping_invoices',
    'public.shipping_fees',
    'public.shipping_payments',
    'public.shipping_batches',
    'public.deliveries',
    'public.damage_order_allocations',
    'public.order_items',
    'public.orders',
    'public.buying_list',
    'public.arrival_items',
    'public.damaged_items',
    'public.follow_ups',
    'public.product_tracking',
    'public.batch_product_shipping',
    'public.batch_products',
    'public.batches'
  ], 'batch delete migration');

  assert.doesNotMatch(sql, /DELETE FROM public\.products/i, 'batch deletion must preserve product catalog rows');
  assert.match(sql, /batch_name = v_batch_name/i, 'batch deletion should clean legacy batch_name rows');
});

test('stock-sale mutation RPCs keep stock and sale rows atomic', () => {
  const sql = read('supabase/migrations/20260710130000_add_stock_sale_mutation_rpcs.sql');
  const normalized = compact(sql);

  assertIncludesAll(sql, [
    'CREATE OR REPLACE FUNCTION public.create_stock_sale_with_items',
    'CREATE OR REPLACE FUNCTION public.update_stock_sale_with_items',
    'CREATE OR REPLACE FUNCTION public.cancel_stock_sale_with_stock_restore',
    'CREATE OR REPLACE FUNCTION public.delete_cancelled_stock_sale',
    'SECURITY DEFINER',
    'public.has_shop_membership(p_shop_id)',
    'jsonb_array_length(p_items)',
    'One or more products do not belong to this shop.',
    'GRANT EXECUTE ON FUNCTION public.create_stock_sale_with_items',
    'GRANT EXECUTE ON FUNCTION public.update_stock_sale_with_items',
    'GRANT EXECUTE ON FUNCTION public.cancel_stock_sale_with_stock_restore',
    'GRANT EXECUTE ON FUNCTION public.delete_cancelled_stock_sale'
  ], 'stock-sale migration');

  assert.match(normalized, /INSERT INTO public\.stock_sales .* INSERT INTO public\.stock_sale_items .* UPDATE public\.products product SET stock = greatest\(0, coalesce\(product\.stock, 0\) - quantities\.quantity\)/i);
  assert.match(normalized, /old_quantities AS .* UPDATE public\.products product SET stock = coalesce\(product\.stock, 0\) \+ old_quantities\.quantity .* DELETE FROM public\.stock_sale_items .* INSERT INTO public\.stock_sale_items .* new_quantities AS .* UPDATE public\.products product SET stock = greatest\(0, coalesce\(product\.stock, 0\) - new_quantities\.quantity\)/i);
  assert.match(normalized, /WHERE id = p_sale_id AND shop_id = p_shop_id AND status = 'open' FOR UPDATE/i);
  assert.match(normalized, /SET status = 'cancelled'.*SET stock = coalesce\(product\.stock, 0\) \+ quantities\.quantity/i);
  assert.match(normalized, /WHERE id = p_sale_id AND shop_id = p_shop_id AND status = 'cancelled' FOR UPDATE/i);
});

test('shipping workflow RPCs guard tenant transitions and keep handoffs transactional', () => {
  const sql = read('supabase/migrations/20260710133000_add_shipping_workflow_rpcs.sql');
  const normalized = compact(sql);

  assertIncludesAll(sql, [
    'CREATE OR REPLACE FUNCTION public.send_confirmed_arrivals_to_shipping',
    'CREATE OR REPLACE FUNCTION public.send_confirmed_arrival_item_to_shipping',
    'CREATE OR REPLACE FUNCTION public.send_paid_client_to_deliveries',
    'SECURITY DEFINER',
    'public.has_shop_membership(p_shop_id)',
    'FOR UPDATE',
    'public.shipping_fees',
    'public.product_tracking',
    'public.deliveries',
    'public.shipping_payments',
    'GRANT EXECUTE ON FUNCTION public.send_confirmed_arrivals_to_shipping',
    'GRANT EXECUTE ON FUNCTION public.send_confirmed_arrival_item_to_shipping',
    'GRANT EXECUTE ON FUNCTION public.send_paid_client_to_deliveries'
  ], 'shipping workflow migration');

  assert.match(normalized, /arrival_items .* SET status = 'sent_to_shipping'/i);
  assert.match(normalized, /shipping_fees .* SET delivery_id = v_delivery_id/i);
  assert.match(normalized, /batches SET delivery_status = 'pending'/i);
});

test('shipping batch totals use batch_id as the canonical upsert key', () => {
  const sql = read('supabase/migrations/20260710140000_prefer_batch_id_for_shipping_totals.sql');
  const dbService = read('app/src/app/services/database.service.ts');
  const shippingService = read('app/src/app/services/shipping-data.service.ts');
  const accessService = read('app/src/app/services/supabase-data-access.service.ts');

  assertIncludesAll(sql, [
    'UPDATE public.shipping_batches',
    'SET batch_id = b.id',
    'PARTITION BY shop_id, batch_id',
    'shipping_batches_shop_batch_id_key UNIQUE (shop_id, batch_id)'
  ], 'shipping totals migration');

  assertIncludesAll(dbService, [
    "const conflictTarget = batchId ? 'shop_id,batch_id' : 'shop_id,batch_name'",
    'upsert(dbRow, { onConflict: conflictTarget })'
  ], 'shipping total save');

  assertIncludesAll(shippingService, [
    'applyResolvedBatchFilter',
    'batch_id, batch_name',
    'batchId: row.batch_id'
  ], 'shipping batch-id filters');

  assertIncludesAll(accessService, [
    'getBatchLookupByName',
    "select('id, name')",
    "query.eq('batch_id', batch.id)"
  ], 'batch lookup helper');
});

test('delivery and damage paths backfill and prefer batch_id over batch_name', () => {
  const sql = read('supabase/migrations/20260710143000_backfill_delivery_damage_batch_ids.sql');
  const dbService = read('app/src/app/services/database.service.ts');
  const dashboardService = read('app/src/app/services/dashboard-data.service.ts');
  const models = read('app/src/app/models/index.ts');

  assertIncludesAll(sql, [
    'UPDATE public.deliveries',
    'UPDATE public.damaged_items',
    'UPDATE public.damage_order_allocations',
    'delivery.batch_id IS NULL',
    'damaged.batch_id IS NULL',
    'allocation.batch_id IS NULL'
  ], 'delivery damage batch backfill migration');

  assertIncludesAll(dbService, [
    'batchId: r.batch_id',
    'doGetDeliveriesByBatch',
    'applyResolvedBatchFilter',
    'batch_id: batchId ?? batch?.id ?? null',
    'batch_id: a.batchId || batch?.id || null'
  ], 'database delivery damage batch-id paths');

  assertIncludesAll(dashboardService, [
    "this.scopeTable(",
    "'damage_order_allocations'",
    ".eq('is_active', true)"
  ], 'dashboard active damage allocation loader');

  assertIncludesAll(models, [
    'batchId?: number | null',
    'batchName?: string'
  ], 'delivery model');
});

test('data services prefer RPCs for high-risk mutations and keep compatibility fallbacks', () => {
  const source = [
    read('app/src/app/services/database.service.ts'),
    read('app/src/app/services/batch-data.service.ts'),
    read('app/src/app/services/product-data.service.ts'),
    read('app/src/app/services/pricing-data.service.ts'),
    read('app/src/app/services/stock-sale-data.service.ts'),
    read('app/src/app/services/shipping-workflow.service.ts'),
    read('app/src/app/services/supabase-data-access.service.ts')
  ].join('\n');

  assertIncludesAll(source, [
    "rpc('delete_product_catalog_cascade'",
    'doDeleteProductCatalogClientScoped',
    "rpc('delete_batch_cascade'",
    'doDeleteBatchCascadeByIdClientScoped',
    "rpc('create_stock_sale_with_items'",
    'doCreateStockSaleClientScoped',
    "rpc('update_stock_sale_with_items'",
    'doUpdateStockSaleClientScoped',
    "rpc('cancel_stock_sale_with_stock_restore'",
    'doCancelStockSaleClientScoped',
    "rpc('delete_cancelled_stock_sale'",
    'doDeleteStockSaleClientScoped',
    'isMissingRpcError'
  ], 'data services');
});

test('shipping workflow facade delegates live RPC-backed transitions to ShippingWorkflowService', () => {
  const dbService = read('app/src/app/services/database.service.ts');
  const workflowService = read('app/src/app/services/shipping-workflow.service.ts');

  assertIncludesAll(dbService, [
    'ShippingWorkflowService',
    'this.shippingWorkflow.sendConfirmedArrivalsToShipping(batchName)',
    'this.shippingWorkflow.sendConfirmedArrivalItemToShipping(arrivalItemId)',
    'this.shippingWorkflow.sendPaidClientToDeliveries(batchName, clientId)'
  ], 'database shipping workflow facade');

  assertIncludesAll(workflowService, [
    'export class ShippingWorkflowService',
    "rpc('send_confirmed_arrivals_to_shipping'",
    "rpc('send_confirmed_arrival_item_to_shipping'",
    "rpc('send_paid_client_to_deliveries'"
  ], 'shipping workflow service');

  assert.doesNotMatch(dbService, /doSendConfirmedArrivalsToShippingClientScoped/);
  assert.doesNotMatch(dbService, /doSendConfirmedArrivalItemToShippingClientScoped/);
  assert.doesNotMatch(dbService, /doSendPaidClientToDeliveriesClientScoped/);
});

test('dashboard page delegates data loading to DashboardDataService', () => {
  const dashboardPage = read('app/src/app/pages/dashboard/dashboard.component.ts');
  const dashboardService = read('app/src/app/services/dashboard-data.service.ts');
  const orderService = read('app/src/app/services/order-data.service.ts');

  assertIncludesAll(dashboardPage, [
    'DashboardDataService',
    'this.dashboardData.loadDashboardData(this.selectedBatchId)',
    "show('stats')",
    "show('attention')",
    'No dashboard sections assigned',
    "batch.status === 'open'",
    'Number(item.damaged_qty || 0)',
    'This Month\'s Expenses by Category'
  ], 'dashboard page');

  assert.doesNotMatch(dashboardPage, /SupabaseService/);
  assert.doesNotMatch(dashboardPage, /\.from\('/);
  assert.match(dashboardService, /loadDashboardData\(requestedBatchId: number \| null = null\): Observable<DashboardDataBundle>/);
  assert.match(dashboardService, /damage_order_allocations/);
  assertIncludesAll(dashboardService, [
    "can('stats')",
    "can('attention')",
    'errors: queryResults.flatMap',
    "payment_status || 'paid'",
    "'id, batch_id, product_id, damaged_qty, created_at'",
    ".order('created_at', { ascending: false })"
  ], 'dashboard data contract');

  assertIncludesAll(orderService, [
    "row.refunded ? 'refunded' : (row.payment_status || 'paid')",
    "data as any).payment_status || 'paid'"
  ], 'order payment status mapping');
  assert.doesNotMatch(dashboardPage, /closedAt \|\| a\.createdAt/);
});

test('dashboard role configuration includes the operational attention queue', () => {
  const models = read('app/src/app/models/index.ts');

  assertIncludesAll(models, [
    'attention: boolean',
    "attention: false",
    "key: 'attention'",
    "label: 'Needs Attention'"
  ], 'dashboard attention permission');
});

test('expense tracking covers core operating costs and is available from navigation', () => {
  const models = read('app/src/app/models/index.ts');
  const expensePage = read('app/src/app/pages/expenses/expenses.component.ts');
  const databaseService = read('app/src/app/services/database.service.ts');
  const migration = read('supabase/migrations/20261026123000_expand_expense_tracking.sql');

  assertIncludesAll(models, [
    "route: '/expenses'",
    "value: 'salary'",
    "value: 'utilities'",
    "value: 'taxes'",
    "value: 'professional_services'",
    "value: 'bank_fees'"
  ], 'expense categories and navigation');

  assertIncludesAll(expensePage, [
    'Salaries & Wages',
    'monthlyUtilities',
    'monthlyCategorySummary',
    'EXPENSE_CATEGORIES',
    'formErrorMessage',
    '@media (max-width: 640px)',
    'grid-template-columns: repeat(2, minmax(0, 1fr))',
    'data-label="Amount"',
    'flex-direction: column'
  ], 'expense management page');

  assertIncludesAll(databaseService, [
    "name: expense.description.trim()",
    "description: expense.description.trim()",
    'payment_method: expense.paymentMethod',
    "description: r.description || r.name || ''",
    'amount: Number(r.amount || 0)'
  ], 'expense persistence');

  assertIncludesAll(migration, [
    'ALTER TABLE public.expenses',
    'ADD COLUMN IF NOT EXISTS description',
    'ADD COLUMN IF NOT EXISTS recipient',
    'ADD COLUMN IF NOT EXISTS payment_method',
    'ADD COLUMN IF NOT EXISTS reference',
    'SET description = name',
    'idx_expenses_shop_category_date'
  ], 'expanded expense schema');
});

test('dashboard and clients provide compact mobile layouts', () => {
  const dashboard = read('app/src/app/pages/dashboard/dashboard.component.ts');
  const clients = read('app/src/app/pages/clients/clients.component.ts');
  const statCards = read('app/src/app/components/stat-cards/stat-cards.component.ts');

  assertIncludesAll(dashboard, [
    '@media (max-width: 640px)',
    '.summary-grid,',
    'grid-template-columns: repeat(2, minmax(0, 1fr))',
    '.summary-grid .compact-stat',
    '.summary-grid .compact-stat:last-child:nth-child(odd)'
  ], 'dashboard mobile summary');

  assertIncludesAll(clients, [
    'cl-mobile-directory',
    'cl-mobile-search',
    'cl-mobile-client',
    'onMobileSearchChange',
    'onMobileSelection',
    '[compactOnMobile]="true"',
    '<span class="material-icons">groups</span>',
    '<span class="material-icons">edit</span>',
    '<span class="material-icons">delete</span>'
  ], 'clients mobile directory');
  assert.doesNotMatch(clients, /class="ri-/);

  assertIncludesAll(statCards, [
    '@Input() compactOnMobile = false',
    'sc-grid-mobile-compact',
    'grid-template-columns: repeat(3, minmax(0, 1fr))'
  ], 'compact mobile stat cards');
});

test('operational pages use compact shared phone layouts', () => {
  const globalStyles = read('app/src/styles.scss');
  const batchCard = read('app/src/app/components/batch-card/batch-card.component.ts');
  const batchList = read('app/src/app/components/batch-list-section/batch-list-section.component.ts');
  const batchDetail = read('app/src/app/components/batch-detail-header/batch-detail-header.component.ts');
  const table = read('app/src/app/components/table/table.component.ts');

  assertIncludesAll(globalStyles, [
    'Shared phone-density pass for operational workspace pages',
    '.arr-header, .batch-header, .bl-header, .dm-page-header',
    '.dv-page-header, .ord-header, .pt-header, .sh-header',
    '.arr-card, .batch-card, .bl-card, .dm-card, .dv-card',
    '.ss-modal-body',
    '.reports-page .stats-grid',
    '.import-page .sheet-item'
  ], 'workspace mobile density');

  assertIncludesAll(batchCard, [
    '@media (max-width: 640px)',
    'grid-template-columns: minmax(0, 1fr) auto',
    'padding: 11px 12px'
  ], 'compact mobile batch cards');

  assertIncludesAll(batchList, [
    'flex-basis: 100%',
    '.bls-grid,',
    'gap: 9px'
  ], 'compact mobile batch lists');

  assertIncludesAll(batchDetail, [
    '@media (max-width: 720px)',
    '.bdh-back-btn',
    'width: auto'
  ], 'compact mobile batch detail');

  assertIncludesAll(table, [
    'flex-wrap: nowrap',
    'overflow-x: auto',
    '.table-filters::-webkit-scrollbar'
  ], 'compact mobile table filters');
});

test('table action columns stay pinned during horizontal scrolling', () => {
  const table = read('app/src/app/components/table/table.component.ts');
  const users = read('app/src/app/pages/users/users.component.ts');
  const stockSales = read('app/src/app/pages/stock-sales/stock-sales.component.ts');
  const deliveries = read('app/src/app/pages/deliveries/deliveries.component.ts');
  const expenses = read('app/src/app/pages/expenses/expenses.component.ts');

  assertIncludesAll(table, [
    "[class.table-sticky-actions]=\"col.type === 'actions'\"",
    '.table-sticky-actions',
    'position: sticky',
    'right: 0',
    '.data-table tbody tr:hover .table-sticky-actions'
  ], 'shared sticky actions');

  for (const [source, label] of [
    [users, 'users sticky actions'],
    [stockSales, 'stock sales sticky actions'],
    [deliveries, 'deliveries sticky actions'],
    [expenses, 'expenses sticky actions']
  ]) {
    assertIncludesAll(source, [
      'th:last-child',
      'td:last-child:not([colspan])',
      'position: sticky',
      'right: 0'
    ], label);
  }
});

test('orders batch cards label both open and closed batches', () => {
  const orders = read('app/src/app/pages/orders/orders.component.ts');

  assertIncludesAll(orders, [
    'readonly orderBatchTagResolver = (batch: OrderBatch): BatchCardTagConfig',
    "batch.status === 'open'",
    "{ tagName: 'Open', color: 'green', icon: 'check_circle' }",
    "{ tagName: 'Closed', color: 'gray', icon: 'task_alt' }"
  ], 'orders batch status tags');
});

test('administration and billing pages avoid oversized phone cards', () => {
  const users = read('app/src/app/pages/users/users.component.ts');
  const roles = read('app/src/app/pages/roles/roles.component.ts');
  const settings = read('app/src/app/pages/settings/settings.component.ts');
  const subscription = read('app/src/app/pages/subscription/subscription.component.scss');
  const platformAdmin = read('app/src/app/pages/platform-admin/platform-admin.component.scss');

  assertIncludesAll(users, [
    'grid-template-columns: repeat(2, minmax(0, 1fr))',
    '.u-page-header > .u-btn',
    '.u-modal-overlay { align-items: flex-end'
  ], 'users mobile layout');

  assertIncludesAll(roles, [
    '@media (max-width: 640px)',
    '.roles-hero-copy h1 { font-size: 25px',
    '.role-card { gap: 9px; padding: 12px'
  ], 'roles mobile layout');

  assertIncludesAll(settings, [
    '.hero-copy h1',
    'font-size: 26px',
    '.settings-card'
  ], 'settings mobile layout');

  assertIncludesAll(subscription, [
    '.price-seal { justify-self:stretch',
    'aspect-ratio:auto',
    '.status-board article { min-height:0'
  ], 'subscription mobile layout');

  assertIncludesAll(platformAdmin, [
    '.metrics { grid-template-columns:repeat(2,minmax(0,1fr))',
    '.metrics article:last-child:nth-child(odd)',
    '.review-grid { grid-template-columns:1fr'
  ], 'platform admin mobile layout');
});

test('order CRUD facade delegates to OrderDataService', () => {
  const dbService = read('app/src/app/services/database.service.ts');
  const orderService = read('app/src/app/services/order-data.service.ts');

  assertIncludesAll(dbService, [
    'OrderDataService',
    'this.orders.getOrders()',
    'this.orders.getOrdersByBatchPage',
    'this.orders.createOrder(order)',
    'this.orders.addOrderItem(item)',
    'this.orders.deleteOrder(id)'
  ], 'database order facade');

  assertIncludesAll(orderService, [
    'export class OrderDataService',
    "this.pricing.assertCanCreateSalesRecord('order')",
    'mapOrderRow',
    'doGetOrderItems'
  ], 'order data service');
});

test('shipping queue and ledger facade delegates to ShippingDataService', () => {
  const dbService = read('app/src/app/services/database.service.ts');
  const shippingService = read('app/src/app/services/shipping-data.service.ts');

  assertIncludesAll(dbService, [
    'ShippingDataService',
    'this.shipping.getShippingQueueBatches()',
    'this.shipping.getShippingQueuePageWithDamage',
    'this.shipping.getShippingLedgerBatches()',
    'this.shipping.getShippingLedger',
    'this.shipping.saveClientPayments'
  ], 'database shipping facade');

  assertIncludesAll(shippingService, [
    'export class ShippingDataService',
    'ShippingLedgerRow',
    'doGetShippingQueuePageWithDamage',
    'doGetShippingLedger',
    'doSaveClientPayments',
    'damage_order_allocations'
  ], 'shipping data service');
});

test('all app-triggered authentication emails use the BatchCommerce Resend sender', () => {
  const authService = read('app/src/app/services/auth.service.ts');
  const adminServer = read('server/index.js');

  assert.match(
    adminServer,
    /SYSTEM_EMAIL_FROM\s*=\s*'BatchCommerce Support <support@pharma-uci\.com>'/
  );
  assertIncludesAll(adminServer, [
    "app.post('/public/register'",
    "app.post('/public/password-reset'",
    "app.post('/admin/resend-verification'",
    'sendEmailWithResend',
    'getEmailLogoUrl',
    '/assets/BatchCommerce.png',
    "type: 'signup'",
    "type: 'recovery'"
  ], 'admin email service');

  assertIncludesAll(authService, [
    '/public/register',
    '/public/password-reset',
    '/admin/resend-verification'
  ], 'auth email client');
  assert.doesNotMatch(
    authService,
    /auth\.(?:resend|resetPasswordForEmail|signUp|inviteUserByEmail)\s*\(/
  );
});
