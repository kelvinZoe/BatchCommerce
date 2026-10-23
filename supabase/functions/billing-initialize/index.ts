import { json, preflight, readJson, errorMessage } from '../_shared/http.ts';
import { initializePaystackTransaction } from '../_shared/paystack.ts';
import { consumeRateLimit, requireShopPermission, requireUser, requiredEnv } from '../_shared/supabase.ts';
import { releasePayment } from '../_shared/billing.ts';

Deno.serve(async request => {
  const cors = preflight(request);
  if (cors) return cors;

  let paymentId = '';
  let cleanupAdmin: any = null;
  try {
    const context = await requireUser(request);
    cleanupAdmin = context.admin;
    const body = await readJson<{ shopId?: string }>(request);
    const shopId = String(body.shopId || '').trim();
    if (!shopId) throw new Error('Shop is required.');

    await requireShopPermission(context, shopId, 'create');
    await consumeRateLimit(context, 'billing_initialize', `${context.user.id}:${shopId}`, 5, 600);

    const reference = `bc_sub_${crypto.randomUUID().replaceAll('-', '')}`;
    const { data: payment, error: createError } = await context.admin.rpc('create_subscription_payment', {
      p_shop_id: shopId,
      p_source: 'paystack',
      p_reference: reference,
      p_submitted_by: context.user.id,
      p_payer_email: context.user.email || null
    });
    if (createError || !payment) throw new Error(createError?.message || 'Could not create the payment.');
    paymentId = payment.id;

    if (Number(payment.amount_minor) === 0) {
      const { data: entitlement, error: applyError } = await context.admin.rpc('apply_subscription_payment', {
        p_payment_id: payment.id,
        p_provider_transaction_id: null,
        p_channel: 'promo',
        p_paid_at: new Date().toISOString()
      });
      if (applyError) throw new Error(applyError.message || 'Could not apply the free renewal.');
      return json(request, { completed: true, payment, entitlement });
    }

    if (!context.user.email) throw new Error('Your account needs an email address before you can pay online.');
    const appBaseUrl = requiredEnv('APP_BASE_URL').replace(/\/$/, '');
    const initialized = await initializePaystackTransaction({
      email: context.user.email,
      amountMinor: Number(payment.amount_minor),
      reference,
      callbackUrl: `${appBaseUrl}/subscription?payment_reference=${encodeURIComponent(reference)}`,
      shopId
    });

    const { error: updateError } = await context.admin
      .from('subscription_payments')
      .update({
        status: 'initialized',
        metadata: { paystack_access_code: initialized.access_code },
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);
    if (updateError) throw new Error(updateError.message || 'Could not save the checkout session.');

    return json(request, {
      completed: false,
      paymentId: payment.id,
      reference,
      amountMinor: Number(payment.amount_minor),
      authorizationUrl: initialized.authorization_url
    });
  } catch (error) {
    if (paymentId) {
      try {
        await releasePayment(cleanupAdmin, paymentId, 'failed', errorMessage(error));
      } catch {
        // Preserve the original initialization failure.
      }
    }
    const message = errorMessage(error, 'Could not start payment.');
    const status = message.includes('permission') || message.includes('Sign in') || message.includes('session') ? 403 : 400;
    return json(request, { error: message }, status);
  }
});
