import { requiredEnv } from './supabase.ts';

const apiBase = 'https://api.paystack.co';

async function paystackRequest(path: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requiredEnv('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.status !== true) {
    throw new Error(body?.message || `Paystack request failed with status ${response.status}.`);
  }
  return body.data;
}

export async function initializePaystackTransaction(input: {
  email: string;
  amountMinor: number;
  reference: string;
  callbackUrl: string;
  shopId: string;
}): Promise<{ authorization_url: string; access_code: string; reference: string }> {
  return paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: String(input.amountMinor),
      currency: 'GHS',
      reference: input.reference,
      callback_url: input.callbackUrl,
      channels: ['card', 'mobile_money'],
      metadata: {
        shop_id: input.shopId,
        purpose: 'batchcommerce_monthly_subscription'
      }
    })
  });
}

export async function verifyPaystackTransaction(reference: string): Promise<any> {
  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyPaystackSignature(rawBody: string, signature: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(requiredEnv('PAYSTACK_SECRET_KEY')),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = toHex(digest);
  if (expected.length !== signature.length) return false;

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return difference === 0;
}

export async function eventKey(rawBody: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawBody));
  return toHex(digest);
}
