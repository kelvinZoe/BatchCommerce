import { json, preflight } from '../_shared/http.ts';
import { MONTHLY_PRICE_MINOR } from '../_shared/billing.ts';
import { requireUser } from '../_shared/supabase.ts';

Deno.serve(async request => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    await requireUser(request);
    return json(request, {
      monthlyPriceMinor: MONTHLY_PRICE_MINOR,
      currency: 'GHS',
      graceDays: 3,
      manualPayment: {
        network: Deno.env.get('MANUAL_MOMO_NETWORK') || 'MTN',
        number: Deno.env.get('MANUAL_MOMO_NUMBER') || '',
        accountName: Deno.env.get('MANUAL_MOMO_NAME') || 'BatchCommerce'
      }
    });
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : 'Could not load billing configuration.' }, 401);
  }
});
