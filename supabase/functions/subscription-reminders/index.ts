import { json, preflight, errorMessage } from '../_shared/http.ts';
import { adminClient, requiredEnv } from '../_shared/supabase.ts';
import { MONTHLY_PRICE_MINOR } from '../_shared/billing.ts';

const DAY_MS = 86400000;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character] || character));
}

function reminderForDays(days: number): { key: string; subject: string } | null {
  if (days === 7) return { key: 'seven_days', subject: 'Your BatchCommerce subscription renews in 7 days' };
  if (days === 3) return { key: 'three_days', subject: '3 days left on your BatchCommerce subscription' };
  if (days === 1) return { key: 'one_day', subject: 'Your BatchCommerce subscription expires tomorrow' };
  if (days === 0) return { key: 'expired', subject: 'Your BatchCommerce subscription has entered grace' };
  if (days === -2) return { key: 'grace_day_two', subject: 'Renew BatchCommerce before access becomes read-only' };
  return null;
}

function reminderHtml(shopName: string, days: number, renewalUrl: string): string {
  const logoUrl = Deno.env.get('EMAIL_LOGO_URL') || '';
  const message = days > 0
    ? `${days} day${days === 1 ? '' : 's'} remain before your current access period ends.`
    : days === 0
      ? 'Your paid access period has ended and the three-day grace period has started.'
      : 'Your grace period is almost over. Renew now to keep creating orders and stock sales.';
  return `<!doctype html><html><body style="margin:0;background:#f6f1e6;font-family:Arial,sans-serif;color:#17312d">
    <div style="max-width:600px;margin:0 auto;padding:32px 18px">
      <div style="background:#fffdf8;border:1px solid #d9e2de;border-radius:22px;padding:30px">
        ${logoUrl ? `<img src="${logoUrl}" alt="BatchCommerce" style="max-width:190px;max-height:60px;object-fit:contain;margin-bottom:24px">` : '<strong style="font-size:20px">BatchCommerce</strong>'}
        <p style="margin:0 0 8px;color:#c77913;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Subscription reminder</p>
        <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:32px;line-height:1.05">Keep ${escapeHtml(shopName)} moving.</h1>
        <p style="margin:0 0 24px;color:#546b67;line-height:1.65">${message} Renew for GHS ${MONTHLY_PRICE_MINOR / 100} to retain the full BatchCommerce workspace.</p>
        <a href="${renewalUrl}" style="display:inline-block;padding:13px 20px;border-radius:999px;background:#123d36;color:#fff;text-decoration:none;font-weight:700">Review subscription</a>
        <p style="margin:26px 0 0;color:#82928f;font-size:12px">BatchCommerce Support &middot; support@pharma-uci.com</p>
      </div>
    </div></body></html>`;
}

Deno.serve(async request => {
  const cors = preflight(request);
  if (cors) return cors;

  if ((request.headers.get('x-cron-secret') || '') !== requiredEnv('CRON_SECRET')) {
    return json(request, { error: 'Invalid cron credentials.' }, 401);
  }

  const admin = adminClient();
  try {
    const now = new Date();
    const [{ data: shops, error: shopsError }, { data: entitlements, error: entitlementError }, { data: owners, error: ownerError }] = await Promise.all([
      admin.from('shops').select('id, name, subscription_status, promo_ends_at'),
      admin.from('subscription_entitlements').select('shop_id, ends_at').is('revoked_at', null),
      admin.from('shop_memberships')
        .select('shop_id, app_users!shop_memberships_app_user_id_fkey(email, full_name)')
        .eq('is_owner', true).eq('is_active', true)
    ]);
    if (shopsError || entitlementError || ownerError) {
      throw new Error(shopsError?.message || entitlementError?.message || ownerError?.message || 'Could not load reminder candidates.');
    }

    const entitlementEnds = new Map<string, Date>();
    for (const entitlement of entitlements || []) {
      const candidate = new Date(entitlement.ends_at);
      const current = entitlementEnds.get(entitlement.shop_id);
      if (!current || candidate > current) entitlementEnds.set(entitlement.shop_id, candidate);
    }
    const ownerEmails = new Map<string, string>();
    for (const owner of owners || []) {
      const profile = Array.isArray(owner.app_users) ? owner.app_users[0] : owner.app_users;
      if (profile?.email) ownerEmails.set(owner.shop_id, profile.email);
    }

    const appBaseUrl = requiredEnv('APP_BASE_URL').replace(/\/$/, '');
    const resendApiKey = requiredEnv('RESEND_API_KEY');
    const from = Deno.env.get('RESEND_FROM_EMAIL') || 'BatchCommerce Support <support@pharma-uci.com>';
    let sent = 0;
    let skipped = 0;

    for (const shop of shops || []) {
      if (['suspended', 'cancelled'].includes(shop.subscription_status)) continue;
      const promoEnd = shop.promo_ends_at ? new Date(shop.promo_ends_at) : null;
      const entitlementEnd = entitlementEnds.get(shop.id) || null;
      const accessEnd = [promoEnd, entitlementEnd].filter(Boolean).sort((a, b) => Number(b) - Number(a))[0] as Date | undefined;
      const email = ownerEmails.get(shop.id);
      if (!accessEnd || !email) continue;
      const days = Math.ceil((accessEnd.getTime() - now.getTime()) / DAY_MS);
      const reminder = reminderForDays(days);
      if (!reminder) continue;

      const { data: delivery } = await admin.from('subscription_reminder_deliveries')
        .select('id, status')
        .eq('shop_id', shop.id)
        .eq('reminder_key', reminder.key)
        .eq('access_ends_at', accessEnd.toISOString())
        .eq('recipient_email', email)
        .maybeSingle();
      if (delivery?.status === 'sent') {
        skipped += 1;
        continue;
      }

      const deliveryId = delivery?.id || crypto.randomUUID();
      await admin.from('subscription_reminder_deliveries').upsert({
        id: deliveryId,
        shop_id: shop.id,
        reminder_key: reminder.key,
        access_ends_at: accessEnd.toISOString(),
        recipient_email: email,
        status: 'pending',
        error_message: null,
        updated_at: new Date().toISOString()
      });

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [email],
          subject: reminder.subject,
          html: reminderHtml(shop.name, days, `${appBaseUrl}/subscription`)
        })
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        sent += 1;
        await admin.from('subscription_reminder_deliveries').update({
          status: 'sent', provider_message_id: result?.id || null,
          sent_at: new Date().toISOString(), updated_at: new Date().toISOString()
        }).eq('id', deliveryId);
      } else {
        await admin.from('subscription_reminder_deliveries').update({
          status: 'failed', error_message: result?.message || `Resend returned ${response.status}`,
          updated_at: new Date().toISOString()
        }).eq('id', deliveryId);
      }
    }

    return json(request, { success: true, sent, skipped });
  } catch (error) {
    return json(request, { error: errorMessage(error, 'Could not send subscription reminders.') }, 500);
  }
});
