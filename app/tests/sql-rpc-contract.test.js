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

test('pricing bands stay aligned across app, migration, and pricing docs', () => {
  const dbService = read('app/src/app/services/database.service.ts');
  const overageMigration = read('supabase/migrations/20260629130000_allow_pricing_overages.sql');
  const pricingDoc = read('PRICING_MODEL.md');

  assert.match(dbService, /starter:\s*\{\s*priceGhs:\s*150,\s*monthlyLimit:\s*40\s*\}/);
  assert.match(dbService, /growth:\s*\{\s*priceGhs:\s*200,\s*monthlyLimit:\s*120\s*\}/);
  assert.match(dbService, /pro:\s*\{\s*priceGhs:\s*300,\s*monthlyLimit:\s*null\s*\}/);

  assert.match(overageMigration, /WHEN 'starter' THEN 40/);
  assert.match(overageMigration, /WHEN 'growth' THEN 120/);
  assert.match(overageMigration, /WHEN 'pro' THEN NULL/);

  assert.match(pricingDoc, /GHS 150 \/ month/);
  assert.match(pricingDoc, /GHS 200 \/ month/);
  assert.match(pricingDoc, /GHS 300 \/ month/);
  assert.match(pricingDoc, /41 - 120 monthly sales records/);
  assert.match(pricingDoc, /121\+ monthly sales records/);
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

test('data services prefer RPCs for high-risk mutations and keep compatibility fallbacks', () => {
  const source = [
    read('app/src/app/services/database.service.ts'),
    read('app/src/app/services/batch-data.service.ts'),
    read('app/src/app/services/product-data.service.ts'),
    read('app/src/app/services/stock-sale-data.service.ts'),
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
