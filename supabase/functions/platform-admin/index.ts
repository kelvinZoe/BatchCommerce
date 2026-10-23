import { json, preflight, readJson, errorMessage } from '../_shared/http.ts';
import { requirePlatformAdmin, requireUser } from '../_shared/supabase.ts';

type AdminBody = {
  action?: string;
  shopId?: string;
  status?: string;
  reason?: string;
  days?: number;
  entitlementId?: string;
  promo?: Record<string, unknown>;
  promoId?: string;
};

async function audit(admin: any, input: {
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  shop_id?: string | null;
  reason?: string | null;
  before_state?: unknown;
  after_state?: unknown;
}) {
  const { error } = await admin.from('platform_action_audit').insert(input);
  if (error) throw new Error(error.message || 'Could not save the admin audit record.');
}

Deno.serve(async request => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    const context = await requireUser(request);
    await requirePlatformAdmin(context);
    const body = await readJson<AdminBody>(request);
    const action = String(body.action || 'overview');

    if (action === 'overview') {
      const [{ data: shops, error: shopsError }, { data: payments, error: paymentsError }, { data: promos, error: promosError }] = await Promise.all([
        context.admin.from('shops')
          .select('id, name, slug, subscription_status, promo_started_at, promo_ends_at, billing_started_at, created_at')
          .order('created_at', { ascending: false }),
        context.admin.from('subscription_payments')
          .select('*, shops(name)')
          .order('created_at', { ascending: false })
          .limit(250),
        context.admin.from('promo_codes')
          .select('id, code, description, extra_promo_days, discount_percent, max_redemptions, redeemed_count, starts_at, expires_at, is_active, created_at')
          .order('created_at', { ascending: false })
      ]);
      if (shopsError || paymentsError || promosError) {
        throw new Error(shopsError?.message || paymentsError?.message || promosError?.message || 'Could not load platform data.');
      }

      const summaries = await Promise.all((shops || []).map(async shop => {
        const { data } = await context.admin.rpc('compute_shop_subscription_summary', {
          p_shop_id: shop.id,
          p_at: new Date().toISOString()
        });
        return { ...shop, subscription_summary: Array.isArray(data) ? data[0] : data };
      }));

      return json(request, { shops: summaries, payments: payments || [], promoCodes: promos || [] });
    }

    if (action === 'set_shop_status') {
      const shopId = String(body.shopId || '').trim();
      const status = String(body.status || '').trim();
      const reason = String(body.reason || '').trim();
      if (!shopId || !['active', 'suspended', 'cancelled', 'past_due'].includes(status)) throw new Error('A valid shop and status are required.');
      if (reason.length < 3) throw new Error('Add a short reason for this status change.');

      const { data: before, error: findError } = await context.admin.from('shops').select('*').eq('id', shopId).single();
      if (findError || !before) throw new Error('Shop was not found.');
      const { data: after, error: updateError } = await context.admin.from('shops').update({
        subscription_status: status,
        plan_updated_at: new Date().toISOString()
      }).eq('id', shopId).select('*').single();
      if (updateError) throw new Error(updateError.message);
      await audit(context.admin, {
        actor_user_id: context.user.id,
        action: 'set_shop_subscription_status',
        target_type: 'shop', target_id: shopId, shop_id: shopId, reason,
        before_state: before, after_state: after
      });
      return json(request, { success: true, shop: after });
    }

    if (action === 'grant_access') {
      const shopId = String(body.shopId || '').trim();
      const days = Number(body.days || 0);
      const reason = String(body.reason || '').trim();
      if (!shopId || !Number.isInteger(days) || days < 1 || days > 365) throw new Error('Choose an access grant between 1 and 365 days.');
      if (reason.length < 3) throw new Error('Add a reason for the access grant.');

      const { data: existing } = await context.admin.from('subscription_entitlements')
        .select('ends_at').eq('shop_id', shopId).is('revoked_at', null).order('ends_at', { ascending: false }).limit(1).maybeSingle();
      const now = new Date();
      const start = existing?.ends_at && new Date(existing.ends_at) > now ? new Date(existing.ends_at) : now;
      const end = new Date(start.getTime() + days * 86400000);
      const grace = new Date(end.getTime() + 3 * 86400000);
      const { data: entitlement, error } = await context.admin.from('subscription_entitlements').insert({
        shop_id: shopId,
        source: 'admin',
        source_reference: `admin:${crypto.randomUUID()}`,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        grace_ends_at: grace.toISOString(),
        created_by: context.user.id,
        note: reason
      }).select('*').single();
      if (error) throw new Error(error.message);
      await audit(context.admin, {
        actor_user_id: context.user.id, action: 'grant_subscription_access',
        target_type: 'subscription_entitlement', target_id: entitlement.id,
        shop_id: shopId, reason, after_state: entitlement
      });
      return json(request, { success: true, entitlement });
    }

    if (action === 'revoke_entitlement') {
      const entitlementId = String(body.entitlementId || '').trim();
      const reason = String(body.reason || '').trim();
      if (!entitlementId || reason.length < 3) throw new Error('Entitlement and revocation reason are required.');
      const { data: before, error: findError } = await context.admin.from('subscription_entitlements').select('*').eq('id', entitlementId).single();
      if (findError || !before) throw new Error('Entitlement was not found.');
      const { data: after, error } = await context.admin.from('subscription_entitlements').update({
        revoked_at: new Date().toISOString(), revoked_by: context.user.id, revocation_reason: reason
      }).eq('id', entitlementId).is('revoked_at', null).select('*').single();
      if (error) throw new Error(error.message);
      await audit(context.admin, {
        actor_user_id: context.user.id, action: 'revoke_subscription_entitlement',
        target_type: 'subscription_entitlement', target_id: entitlementId,
        shop_id: before.shop_id, reason, before_state: before, after_state: after
      });
      return json(request, { success: true, entitlement: after });
    }

    if (action === 'save_promo') {
      const promo = body.promo || {};
      const promoId = String(body.promoId || '').trim();
      const code = String(promo.code || '').trim();
      const extraPromoDays = Number(promo.extraPromoDays || 0);
      const discountPercent = promo.discountPercent === null || promo.discountPercent === undefined || promo.discountPercent === ''
        ? null : Number(promo.discountPercent);
      if (!code || extraPromoDays < 0 || (discountPercent !== null && (discountPercent < 0 || discountPercent > 100))) {
        throw new Error('Enter a valid promo code, days, and discount percentage.');
      }
      const values = {
        code,
        code_normalized: code.toUpperCase().replace(/\s+/g, ''),
        description: String(promo.description || '').trim() || null,
        extra_promo_days: extraPromoDays,
        discount_percent: discountPercent,
        max_redemptions: promo.maxRedemptions ? Number(promo.maxRedemptions) : null,
        starts_at: promo.startsAt || new Date().toISOString(),
        expires_at: promo.expiresAt || null,
        is_active: promo.isActive !== false,
        updated_at: new Date().toISOString()
      };
      const query = promoId
        ? context.admin.from('promo_codes').update(values).eq('id', promoId)
        : context.admin.from('promo_codes').insert(values);
      const { data: saved, error } = await query.select('*').single();
      if (error) throw new Error(error.message);
      await audit(context.admin, {
        actor_user_id: context.user.id,
        action: promoId ? 'update_promo_code' : 'create_promo_code',
        target_type: 'promo_code', target_id: saved.id,
        reason: String(promo.description || '').trim() || null, after_state: saved
      });
      return json(request, { success: true, promoCode: saved });
    }

    if (action === 'toggle_promo') {
      const promoId = String(body.promoId || '').trim();
      const { data: before, error: findError } = await context.admin.from('promo_codes').select('*').eq('id', promoId).single();
      if (findError || !before) throw new Error('Promo code was not found.');
      const { data: after, error } = await context.admin.from('promo_codes').update({
        is_active: !before.is_active,
        updated_at: new Date().toISOString()
      }).eq('id', promoId).select('*').single();
      if (error) throw new Error(error.message);
      await audit(context.admin, {
        actor_user_id: context.user.id, action: after.is_active ? 'activate_promo_code' : 'deactivate_promo_code',
        target_type: 'promo_code', target_id: promoId, before_state: before, after_state: after
      });
      return json(request, { success: true, promoCode: after });
    }

    throw new Error('Unsupported platform-admin action.');
  } catch (error) {
    const message = errorMessage(error, 'Platform operation failed.');
    const status = message.includes('administrator') || message.includes('session') ? 403 : 400;
    return json(request, { error: message }, status);
  }
});
