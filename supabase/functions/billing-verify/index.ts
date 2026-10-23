import { json, preflight, readJson, errorMessage } from '../_shared/http.ts';
import { verifyAndApplyPaystackPayment } from '../_shared/billing.ts';
import { consumeRateLimit, requireShopPermission, requireUser } from '../_shared/supabase.ts';

Deno.serve(async request => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    const context = await requireUser(request);
    const body = await readJson<{ reference?: string }>(request);
    const reference = String(body.reference || '').trim();
    if (!reference) throw new Error('Payment reference is required.');

    const { data: payment, error: findError } = await context.admin
      .from('subscription_payments')
      .select('id, shop_id, provider_reference')
      .eq('provider', 'paystack')
      .eq('provider_reference', reference)
      .single();
    if (findError || !payment) throw new Error('Subscription payment was not found.');

    await requireShopPermission(context, payment.shop_id, 'view');
    await consumeRateLimit(context, 'billing_verify', `${context.user.id}:${payment.shop_id}`, 10, 600);
    const result = await verifyAndApplyPaystackPayment(context.admin, reference);
    return json(request, {
      success: true,
      payment: result.payment,
      entitlement: result.entitlement
    });
  } catch (error) {
    return json(request, { error: errorMessage(error, 'Could not verify payment.') }, 400);
  }
});
