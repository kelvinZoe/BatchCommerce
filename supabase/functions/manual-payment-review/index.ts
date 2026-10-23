import { json, preflight, readJson, errorMessage } from '../_shared/http.ts';
import { requirePlatformAdmin, requireUser } from '../_shared/supabase.ts';

Deno.serve(async request => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    const context = await requireUser(request);
    await requirePlatformAdmin(context);
    const body = await readJson<{ paymentId?: string; decision?: string; note?: string }>(request);
    const paymentId = String(body.paymentId || '').trim();
    const decision = String(body.decision || '').trim().toLowerCase();
    const note = String(body.note || '').trim();
    if (!paymentId || !['approve', 'reject'].includes(decision)) throw new Error('Payment and review decision are required.');
    if (decision === 'reject' && note.length < 3) throw new Error('Add a short reason when rejecting a payment.');

    const { data: payment, error } = await context.admin.rpc('review_manual_subscription_payment', {
      p_payment_id: paymentId,
      p_decision: decision,
      p_reviewer: context.user.id,
      p_note: note || null
    });
    if (error) throw new Error(error.message || 'Could not review the payment.');
    return json(request, { success: true, payment });
  } catch (error) {
    return json(request, { error: errorMessage(error, 'Could not review the payment.') }, 400);
  }
});
