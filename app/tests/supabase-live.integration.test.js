const assert = require('node:assert/strict');
const test = require('node:test');

const KNOWN_PRODUCTION_HOSTS = [
  'hlewyduelyxzkezetnhb.supabase.co'
];

const REQUIRED_ENV = [
  'SUPABASE_TEST_URL',
  'SUPABASE_TEST_ANON_KEY',
  'SUPABASE_TEST_SERVICE_ROLE_KEY'
];

const integrationTestsEnabled = process.env.RUN_SUPABASE_INTEGRATION_TESTS === 'true';
const disabledReason = integrationTestsEnabled
  ? undefined
  : 'Set RUN_SUPABASE_INTEGRATION_TESTS=true with a dedicated Supabase test project to run live integration tests.';

function requireSafeIntegrationEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required live-test env vars: ${missing.join(', ')}`);
  }

  const url = process.env.SUPABASE_TEST_URL;

  for (const host of KNOWN_PRODUCTION_HOSTS) {
    if (url.includes(host)) {
      throw new Error(`Refusing to run live integration tests against known production Supabase project: ${host}`);
    }
  }

  const lowerUrl = url.toLowerCase();
  const looksLikeSafeTarget = [
    'localhost',
    '127.0.0.1',
    'test',
    'staging',
    'dev'
  ].some((marker) => lowerUrl.includes(marker));

  if (!looksLikeSafeTarget && process.env.ALLOW_NON_TEST_SUPABASE_URL !== 'true') {
    throw new Error(
      'SUPABASE_TEST_URL does not look like a local/test/staging/dev project. ' +
      'Use a dedicated test project or set ALLOW_NON_TEST_SUPABASE_URL=true intentionally.'
    );
  }
}

function createSupabaseClient(key) {
  const { createClient } = require('@supabase/supabase-js');

  return createClient(process.env.SUPABASE_TEST_URL, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
}

function uniqueToken(label) {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${safeLabel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function expectNoError(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || 'unexpected Supabase error'}`);
  return result.data;
}

async function createSignedInClient(email, password) {
  const client = createSupabaseClient(process.env.SUPABASE_TEST_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  assert.equal(error, null, `sign in test user: ${error?.message || 'unexpected auth error'}`);
  return client;
}

async function createLiveTestContext(label, overrides = {}) {
  requireSafeIntegrationEnv();

  const admin = createSupabaseClient(process.env.SUPABASE_TEST_SERVICE_ROLE_KEY);
  const token = uniqueToken(label);
  const email = `${token}@example.test`;
  const password = `Test-${token}-Password-123!`;
  const cleanup = {
    admin,
    authUserId: null,
    shopId: null,
    promoCodeIds: []
  };

  async function destroy() {
    if (cleanup.shopId) {
      await admin.from('shops').delete().eq('id', cleanup.shopId);
    }

    for (const promoCodeId of cleanup.promoCodeIds) {
      await admin.from('promo_codes').delete().eq('id', promoCodeId);
    }

    if (cleanup.authUserId) {
      await admin.auth.admin.deleteUser(cleanup.authUserId);
    }
  }

  try {
    const authResult = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: 'Live Integration User',
        username: token
      }
    });
    assert.equal(authResult.error, null, `create auth user: ${authResult.error?.message || 'unexpected auth error'}`);
    cleanup.authUserId = authResult.data.user.id;

    const shop = expectNoError(
      await admin
        .from('shops')
        .insert({
          name: `Live Test ${token}`,
          slug: token,
          owner_device_id: `device-${token}`,
          subscription_plan: 'standard',
          subscription_status: overrides.subscriptionStatus || 'active',
          promo_started_at: overrides.promoStartedAt || new Date().toISOString(),
          promo_ends_at: overrides.promoEndsAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select('id, name, slug, subscription_plan, subscription_status, promo_ends_at')
        .single(),
      'create test shop'
    );
    cleanup.shopId = shop.id;

    const appUser = expectNoError(
      await admin
        .from('app_users')
        .insert({
          auth_id: cleanup.authUserId,
          username: token,
          full_name: 'Live Integration User',
          email
        })
        .select('id')
        .single(),
      'create app user'
    );

    expectNoError(
      await admin
        .from('shop_memberships')
        .insert({
          shop_id: cleanup.shopId,
          auth_user_id: cleanup.authUserId,
          app_user_id: appUser.id,
          is_owner: true,
          is_active: true,
          membership_status: 'active',
          accepted_at: new Date().toISOString(),
          last_selected_at: new Date().toISOString()
        })
        .select('id')
        .single(),
      'create owner membership'
    );

    const user = await createSignedInClient(email, password);

    return {
      admin,
      appUser,
      cleanup,
      destroy,
      email,
      password,
      shop,
      token,
      user
    };
  } catch (error) {
    try {
      await destroy();
    } catch {
      // Preserve the original setup error; cleanup failures are secondary here.
    }
    throw error;
  }
}

async function seedCatalog(admin, shopId, token) {
  const batch = expectNoError(
    await admin
      .from('batches')
      .insert({
        shop_id: shopId,
        name: `Batch ${token}`,
        status: 'open'
      })
      .select('id, name')
      .single(),
    'create test batch'
  );

  const product = expectNoError(
    await admin
      .from('products')
      .insert({
        shop_id: shopId,
        name: `Product ${token}`,
        sku: token,
        stock: 10,
        purchase_price: 20,
        preorder_price: 35,
        stock_price: 45
      })
      .select('id, stock')
      .single(),
    'create test product'
  );

  const batchProduct = expectNoError(
    await admin
      .from('batch_products')
      .insert({
        shop_id: shopId,
        batch_id: batch.id,
        product_id: product.id,
        preorder_price: 35,
        stock_price: 45,
        in_stock_qty: 10
      })
      .select('id')
      .single(),
    'create test batch product'
  );

  return { batch, batchProduct, product };
}

test('live Supabase integration env is deliberately configured', { skip: disabledReason }, () => {
  requireSafeIntegrationEnv();

  assert.ok(process.env.SUPABASE_TEST_URL.startsWith('http'), 'SUPABASE_TEST_URL should be a URL');
  assert.notEqual(process.env.SUPABASE_TEST_ANON_KEY, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY);
});

test('live Supabase test project accepts service-role schema reads', { skip: disabledReason }, async () => {
  requireSafeIntegrationEnv();

  const admin = createSupabaseClient(process.env.SUPABASE_TEST_SERVICE_ROLE_KEY);
  const { error } = await admin
    .from('shops')
    .select('id', { count: 'exact', head: true })
    .limit(1);

  assert.equal(error, null, error?.message);
});

test('live Supabase test project accepts anon client initialization', { skip: disabledReason }, () => {
  requireSafeIntegrationEnv();

  const anon = createSupabaseClient(process.env.SUPABASE_TEST_ANON_KEY);

  assert.ok(anon.auth, 'anon client should expose auth API');
  assert.ok(anon.from('shops'), 'anon client should expose table query builder');
});

test('live promo-code redemption updates shop promo state once per shop', { skip: disabledReason }, async () => {
  const context = await createLiveTestContext('promo-redemption', {
    subscriptionStatus: 'promo'
  });

  try {
    const promoCode = expectNoError(
      await context.admin
        .from('promo_codes')
        .insert({
          code: `PROMO-${context.token}`,
          description: 'Live integration promo',
          extra_promo_days: 10,
          discount_percent: 25,
          max_redemptions: 1
        })
        .select('id, code')
        .single(),
      'create promo code'
    );
    context.cleanup.promoCodeIds.push(promoCode.id);

    const redemption = expectNoError(
      await context.user.rpc('redeem_shop_promo_code', {
        p_shop_id: context.shop.id,
        p_code: promoCode.code.toLowerCase()
      }),
      'redeem promo code'
    );

    assert.equal(redemption.length, 1);
    assert.equal(redemption[0].plan_override, null);
    assert.equal(redemption[0].extra_promo_days, 10);

    const updatedShop = expectNoError(
      await context.admin
        .from('shops')
        .select('subscription_plan, subscription_status, promo_ends_at')
        .eq('id', context.shop.id)
        .single(),
      'read updated promo shop'
    );

    assert.equal(updatedShop.subscription_plan, 'standard');
    assert.equal(updatedShop.subscription_status, 'promo');
    assert.ok(new Date(updatedShop.promo_ends_at) > new Date(context.shop.promo_ends_at));

    const duplicate = await context.user.rpc('redeem_shop_promo_code', {
      p_shop_id: context.shop.id,
      p_code: promoCode.code
    });

    assert.notEqual(duplicate.error, null, 'duplicate promo redemption should fail');
    assert.match(duplicate.error.message, /already been used/i);
  } finally {
    await context.destroy();
  }
});

test('live pricing guard blocks expired promo shops but allows active paid sales records', { skip: disabledReason }, async () => {
  const context = await createLiveTestContext('pricing-guard', {
    subscriptionStatus: 'promo',
    promoEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  });

  try {
    const { batch } = await seedCatalog(context.admin, context.shop.id, context.token);
    const customer = expectNoError(
      await context.admin
        .from('customers')
        .insert({
          shop_id: context.shop.id,
          name: `Customer ${context.token}`,
          phone: '0000000000'
        })
        .select('id')
        .single(),
      'create test customer'
    );

    const blockedOrder = await context.user
      .from('orders')
      .insert({
        shop_id: context.shop.id,
        batch_id: batch.id,
        customer_id: customer.id,
        total: 45,
        payment_status: 'paid'
      })
      .select('id')
      .single();

    assert.notEqual(blockedOrder.error, null, 'expired promo shop should be blocked from creating sales records');
    assert.match(blockedOrder.error.message, /access has ended|GHS 100 monthly subscription/i);

    expectNoError(
      await context.admin
        .from('shops')
        .update({
          subscription_status: 'active',
          subscription_plan: 'standard'
        })
        .eq('id', context.shop.id),
      'activate test shop'
    );

    const entitlementStart = new Date();
    const entitlementEnd = new Date(entitlementStart);
    entitlementEnd.setUTCMonth(entitlementEnd.getUTCMonth() + 1);
    expectNoError(
      await context.admin
        .from('subscription_entitlements')
        .insert({
          shop_id: context.shop.id,
          source: 'admin',
          source_reference: `live-test:${context.token}`,
          starts_at: entitlementStart.toISOString(),
          ends_at: entitlementEnd.toISOString(),
          grace_ends_at: new Date(entitlementEnd.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          note: 'Live integration test entitlement'
        })
        .select('id')
        .single(),
      'create active subscription entitlement'
    );

    const paidOrder = expectNoError(
      await context.user
        .from('orders')
        .insert({
          shop_id: context.shop.id,
          batch_id: batch.id,
          customer_id: customer.id,
          total: 45,
          payment_status: 'paid'
        })
        .select('id')
        .single(),
      'create paid-plan order'
    );

    assert.ok(paidOrder.id);
  } finally {
    await context.destroy();
  }
});

test('live subscription payment application is idempotent and extends access once', { skip: disabledReason }, async () => {
  const context = await createLiveTestContext('subscription-payment', {
    subscriptionStatus: 'past_due',
    promoEndsAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  });

  try {
    const reference = `bc_test_${context.token.replace(/-/g, '')}`;
    const payment = expectNoError(
      await context.admin.rpc('create_subscription_payment', {
        p_shop_id: context.shop.id,
        p_source: 'paystack',
        p_reference: reference,
        p_submitted_by: context.cleanup.authUserId,
        p_payer_email: context.email
      }),
      'create subscription payment'
    );

    const first = expectNoError(
      await context.admin.rpc('apply_subscription_payment', {
        p_payment_id: payment.id,
        p_provider_transaction_id: `paystack-${context.token}`,
        p_channel: 'mobile_money',
        p_paid_at: new Date().toISOString()
      }),
      'apply subscription payment'
    );
    const second = expectNoError(
      await context.admin.rpc('apply_subscription_payment', {
        p_payment_id: payment.id,
        p_provider_transaction_id: `paystack-${context.token}`,
        p_channel: 'mobile_money',
        p_paid_at: new Date().toISOString()
      }),
      'replay subscription payment'
    );

    assert.equal(first.id, second.id, 'replayed payment should return the original entitlement');
    const { count, error: countError } = await context.admin
      .from('subscription_entitlements')
      .select('id', { count: 'exact', head: true })
      .eq('payment_id', payment.id);
    assert.equal(countError, null);
    assert.equal(count, 1);

    const summary = expectNoError(
      await context.user.rpc('get_shop_subscription_summary', { p_shop_id: context.shop.id }),
      'read active subscription summary'
    );
    assert.equal(summary[0].access_state, 'active');
    assert.equal(summary[0].can_create_sales_record, true);
  } finally {
    await context.destroy();
  }
});

test('live subscription summary allows the three-day grace window', { skip: disabledReason }, async () => {
  const context = await createLiveTestContext('subscription-grace', {
    subscriptionStatus: 'past_due',
    promoEndsAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  });

  try {
    const end = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expectNoError(
      await context.admin.from('subscription_entitlements').insert({
        shop_id: context.shop.id,
        source: 'admin',
        source_reference: `grace-test:${context.token}`,
        starts_at: new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        ends_at: end.toISOString(),
        grace_ends_at: new Date(end.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        note: 'Live grace test'
      }).select('id').single(),
      'create grace entitlement'
    );

    const summary = expectNoError(
      await context.user.rpc('get_shop_subscription_summary', { p_shop_id: context.shop.id }),
      'read grace subscription summary'
    );
    assert.equal(summary[0].access_state, 'grace');
    assert.equal(summary[0].can_create_sales_record, true);
  } finally {
    await context.destroy();
  }
});

test('live stock-sale RPC lifecycle adjusts stock atomically', { skip: disabledReason }, async () => {
  const context = await createLiveTestContext('stock-sale-rpc');

  try {
    const { batchProduct, product } = await seedCatalog(context.admin, context.shop.id, context.token);

    const created = expectNoError(
      await context.user.rpc('create_stock_sale_with_items', {
        p_shop_id: context.shop.id,
        p_customer_id: null,
        p_customer_name: 'Walk-in',
        p_sale_channel: 'walk_in',
        p_total_amount: 135,
        p_items: [{
          batchProductId: batchProduct.id,
          productId: product.id,
          quantity: 3,
          unitPrice: 45,
          subtotal: 135
        }]
      }),
      'create stock sale RPC'
    );

    const saleId = created[0].id;
    assert.ok(saleId);

    let stock = expectNoError(
      await context.admin.from('products').select('stock').eq('id', product.id).single(),
      'read stock after create'
    );
    assert.equal(stock.stock, 7);

    const updated = expectNoError(
      await context.user.rpc('update_stock_sale_with_items', {
        p_shop_id: context.shop.id,
        p_sale_id: saleId,
        p_customer_id: null,
        p_customer_name: 'Walk-in Updated',
        p_sale_channel: 'walk_in',
        p_total_amount: 180,
        p_items: [{
          batchProductId: batchProduct.id,
          productId: product.id,
          quantity: 4,
          unitPrice: 45,
          subtotal: 180
        }]
      }),
      'update stock sale RPC'
    );
    assert.equal(updated, true);

    stock = expectNoError(
      await context.admin.from('products').select('stock').eq('id', product.id).single(),
      'read stock after update'
    );
    assert.equal(stock.stock, 6);

    const cancelled = expectNoError(
      await context.user.rpc('cancel_stock_sale_with_stock_restore', {
        p_shop_id: context.shop.id,
        p_sale_id: saleId
      }),
      'cancel stock sale RPC'
    );
    assert.equal(cancelled, true);

    stock = expectNoError(
      await context.admin.from('products').select('stock').eq('id', product.id).single(),
      'read stock after cancel'
    );
    assert.equal(stock.stock, 10);

    const deleted = expectNoError(
      await context.user.rpc('delete_cancelled_stock_sale', {
        p_shop_id: context.shop.id,
        p_sale_id: saleId
      }),
      'delete cancelled stock sale RPC'
    );
    assert.equal(deleted, true);

    const remaining = expectNoError(
      await context.admin.from('stock_sales').select('id').eq('id', saleId),
      'read deleted stock sale'
    );
    assert.equal(remaining.length, 0);
  } finally {
    await context.destroy();
  }
});

test('live batch/order workflow rows can move from buying list to arrivals', { skip: disabledReason }, async () => {
  const context = await createLiveTestContext('batch-workflow');

  try {
    const { batch, batchProduct, product } = await seedCatalog(context.admin, context.shop.id, context.token);
    const customer = expectNoError(
      await context.admin
        .from('customers')
        .insert({
          shop_id: context.shop.id,
          name: `Customer ${context.token}`,
          phone: '0000000000'
        })
        .select('id')
        .single(),
      'create workflow customer'
    );

    const order = expectNoError(
      await context.user
        .from('orders')
        .insert({
          shop_id: context.shop.id,
          batch_id: batch.id,
          customer_id: customer.id,
          total: 70,
          payment_status: 'paid'
        })
        .select('id')
        .single(),
      'create workflow order'
    );

    const orderItem = expectNoError(
      await context.user
        .from('order_items')
        .insert({
          shop_id: context.shop.id,
          order_id: order.id,
          batch_product_id: batchProduct.id,
          product_id: product.id,
          quantity: 2,
          unit_price: 35,
          subtotal: 70
        })
        .select('id')
        .single(),
      'create workflow order item'
    );
    assert.ok(orderItem.id);

    const buyingItem = expectNoError(
      await context.user
        .from('buying_list')
        .insert({
          shop_id: context.shop.id,
          batch_id: batch.id,
          batch_product_id: batchProduct.id,
          product_id: product.id,
          source: 'client',
          requested_qty: 2,
          ordered_qty: 2,
          order_count: 1,
          status: 'ordered'
        })
        .select('id')
        .single(),
      'create buying-list row'
    );

    const arrivalItem = expectNoError(
      await context.user
        .from('arrival_items')
        .insert({
          shop_id: context.shop.id,
          batch_id: batch.id,
          batch_product_id: batchProduct.id,
          product_id: product.id,
          requested_qty: 2,
          received_qty: 2,
          confirmed_qty: 2,
          confirmed: true,
          status: 'confirmed'
        })
        .select('id')
        .single(),
      'create arrival row'
    );

    expectNoError(
      await context.user
        .from('buying_list')
        .update({
          moved_to_arrivals: true,
          status: 'arrived'
        })
        .eq('id', buyingItem.id),
      'mark buying-list row moved'
    );

    const workflowState = expectNoError(
      await context.admin
        .from('arrival_items')
        .select('id, confirmed, status')
        .eq('id', arrivalItem.id)
        .single(),
      'read arrival workflow state'
    );

    assert.equal(workflowState.confirmed, true);
    assert.equal(workflowState.status, 'confirmed');
  } finally {
    await context.destroy();
  }
});
