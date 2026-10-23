import { json, preflight, readJson, errorMessage } from '../_shared/http.ts';
import { consumeRateLimit, requireShopPermission, requireUser } from '../_shared/supabase.ts';

const phonePattern = /^\+?[0-9]{9,15}$/;

Deno.serve(async request => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    const context = await requireUser(request);
    const body = await readJson<{
      shopId?: string;
      senderName?: string;
      senderPhone?: string;
      network?: string;
      transactionReference?: string;
      paidAt?: string;
    }>(request);

    const shopId = String(body.shopId || '').trim();
    const senderName = String(body.senderName || '').trim();
    const senderPhone = String(body.senderPhone || '').replace(/[\s()-]/g, '');
    const network = String(body.network || '').trim().toLowerCase();
    const transactionReference = String(body.transactionReference || '').trim();
    const paidAt = new Date(String(body.paidAt || ''));

    if (!shopId || !senderName || !senderPhone || !transactionReference || Number.isNaN(paidAt.getTime())) {
      throw new Error('Sender name, phone, network, transaction reference, and payment date are required.');
    }
    if (!phonePattern.test(senderPhone)) throw new Error('Enter a valid MoMo sender number.');
    if (!['mtn', 'telecel', 'airteltigo'].includes(network)) throw new Error('Choose a supported mobile money network.');
    if (transactionReference.length < 5 || transactionReference.length > 100) throw new Error('Enter a valid transaction reference.');
    if (paidAt.getTime() > Date.now() + 5 * 60 * 1000) throw new Error('Payment date cannot be in the future.');

    await requireShopPermission(context, shopId, 'create');
    await consumeRateLimit(context, 'manual_payment', `${context.user.id}:${shopId}`, 3, 86400);

    const { data: payment, error } = await context.admin.rpc('create_subscription_payment', {
      p_shop_id: shopId,
      p_source: 'manual',
      p_reference: `bc_manual_${crypto.randomUUID().replaceAll('-', '')}`,
      p_submitted_by: context.user.id,
      p_payer_email: context.user.email || null,
      p_manual_sender_name: senderName,
      p_manual_sender_phone: senderPhone,
      p_manual_network: network,
      p_manual_reference: transactionReference,
      p_manual_paid_at: paidAt.toISOString()
    });
    if (error || !payment) {
      if (String(error?.message || '').toLowerCase().includes('duplicate')) {
        throw new Error('This MoMo transaction reference has already been submitted.');
      }
      throw new Error(error?.message || 'Could not submit the manual payment.');
    }

    return json(request, { success: true, payment });
  } catch (error) {
    return json(request, { error: errorMessage(error, 'Could not submit the manual payment.') }, 400);
  }
});
