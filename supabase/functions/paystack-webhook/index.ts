import { json, preflight, errorMessage } from '../_shared/http.ts';
import { eventKey, verifyPaystackSignature } from '../_shared/paystack.ts';
import { adminClient } from '../_shared/supabase.ts';
import { verifyAndApplyPaystackPayment } from '../_shared/billing.ts';

Deno.serve(async request => {
  const cors = preflight(request);
  if (cors) return cors;

  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature') || '';
  if (!await verifyPaystackSignature(rawBody, signature)) {
    return json(request, { error: 'Invalid Paystack signature.' }, 401);
  }

  const admin = adminClient();
  let eventId = '';
  try {
    const event = JSON.parse(rawBody);
    const reference = String(event?.data?.reference || event?.data?.transaction?.reference || '').trim();
    const key = await eventKey(rawBody);
    const sanitizedPayload = {
      reference,
      status: event?.data?.status || null,
      amount: event?.data?.amount || null,
      currency: event?.data?.currency || null,
      channel: event?.data?.channel || null,
      transaction_id: event?.data?.id || event?.data?.transaction?.id || null
    };

    const { data: existingEvent } = await admin
      .from('subscription_provider_events')
      .select('id, status')
      .eq('provider', 'paystack')
      .eq('event_key', key)
      .maybeSingle();
    if (existingEvent?.status === 'processed' || existingEvent?.status === 'ignored') {
      return json(request, { received: true, duplicate: true });
    }

    let storedEvent = existingEvent;
    if (!storedEvent) {
      const { data: insertedEvent, error: storeError } = await admin
        .from('subscription_provider_events')
        .insert({
        provider: 'paystack',
        event_key: key,
        event_type: String(event?.event || 'unknown'),
        provider_reference: reference || null,
        payload: sanitizedPayload
        })
        .select('id, status')
        .single();
      if (storeError) {
        const { data: racedEvent } = await admin
          .from('subscription_provider_events')
          .select('id, status')
          .eq('provider', 'paystack')
          .eq('event_key', key)
          .single();
        storedEvent = racedEvent;
      } else {
        storedEvent = insertedEvent;
      }
    }
    if (!storedEvent) throw new Error('Could not persist the provider event.');
    eventId = storedEvent.id;
    if (storedEvent.status === 'processed') return json(request, { received: true, duplicate: true });

    if (event?.event === 'charge.success' && reference) {
      await verifyAndApplyPaystackPayment(admin, reference);
      await admin.from('subscription_provider_events').update({
        status: 'processed', processed_at: new Date().toISOString(), error_message: null
      }).eq('id', eventId);
      return json(request, { received: true, processed: true });
    }

    if (event?.event === 'refund.processed' && reference) {
      const { data: payment } = await admin
        .from('subscription_payments')
        .select('id, shop_id, status')
        .eq('provider', 'paystack')
        .eq('provider_reference', reference)
        .maybeSingle();

      if (payment) {
        await admin.from('subscription_payments').update({
          status: 'refunded', updated_at: new Date().toISOString()
        }).eq('id', payment.id);
        await admin.from('subscription_entitlements').update({
          revoked_at: new Date().toISOString(),
          revocation_reason: 'Paystack refund processed.'
        }).eq('payment_id', payment.id).is('revoked_at', null);
        await admin.from('platform_action_audit').insert({
          action: 'paystack_refund_processed',
          target_type: 'subscription_payment',
          target_id: payment.id,
          shop_id: payment.shop_id,
          reason: 'Provider webhook reported a processed refund.'
        });
      }
      await admin.from('subscription_provider_events').update({
        status: 'processed', processed_at: new Date().toISOString(), error_message: null
      }).eq('id', eventId);
      return json(request, { received: true, processed: true });
    }

    await admin.from('subscription_provider_events').update({
      status: 'ignored', processed_at: new Date().toISOString()
    }).eq('id', eventId);
    return json(request, { received: true, ignored: true });
  } catch (error) {
    if (eventId) {
      await admin.from('subscription_provider_events').update({
        status: 'failed', error_message: errorMessage(error), processed_at: new Date().toISOString()
      }).eq('id', eventId);
    }
    // A non-2xx response asks Paystack to retry transient failures.
    return json(request, { error: errorMessage(error, 'Webhook processing failed.') }, 500);
  }
});
