import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.95.3';
import { verifyPaystackTransaction } from './paystack.ts';

export const MONTHLY_PRICE_MINOR = 10000;

export async function verifyAndApplyPaystackPayment(
  admin: SupabaseClient,
  reference: string
): Promise<{ payment: any; entitlement: any; transaction: any }> {
  const { data: payment, error: paymentError } = await admin
    .from('subscription_payments')
    .select('*')
    .eq('provider', 'paystack')
    .eq('provider_reference', reference)
    .single();

  if (paymentError || !payment) throw new Error('Subscription payment was not found.');

  if (payment.status === 'successful') {
    const { data: entitlement } = await admin
      .from('subscription_entitlements')
      .select('*')
      .eq('payment_id', payment.id)
      .maybeSingle();
    return { payment, entitlement, transaction: null };
  }

  const transaction = await verifyPaystackTransaction(reference);
  if (transaction?.status !== 'success') throw new Error('Paystack has not confirmed this payment.');
  if (String(transaction?.reference || '') !== reference) throw new Error('Paystack returned a different payment reference.');
  if (String(transaction?.currency || '').toUpperCase() !== 'GHS') throw new Error('Payment currency does not match the subscription charge.');
  if (Number(transaction?.amount) !== Number(payment.amount_minor)) throw new Error('Payment amount does not match the subscription charge.');

  const { data: entitlement, error: applyError } = await admin.rpc('apply_subscription_payment', {
    p_payment_id: payment.id,
    p_provider_transaction_id: String(transaction.id || ''),
    p_channel: String(transaction.channel || ''),
    p_paid_at: transaction.paid_at || transaction.paidAt || new Date().toISOString()
  });
  if (applyError) throw new Error(applyError.message || 'Could not activate the subscription.');

  const { data: updatedPayment } = await admin
    .from('subscription_payments')
    .select('*')
    .eq('id', payment.id)
    .single();

  return { payment: updatedPayment || payment, entitlement, transaction };
}

export async function releasePayment(
  admin: SupabaseClient,
  paymentId: string,
  status: 'failed' | 'abandoned' | 'rejected',
  reason: string
): Promise<void> {
  const { error } = await admin.rpc('release_subscription_payment', {
    p_payment_id: paymentId,
    p_status: status,
    p_reason: reason
  });
  if (error) throw new Error(error.message || 'Could not close the payment attempt.');
}
