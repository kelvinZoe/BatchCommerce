import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PricingPlanKey,
  PricingUsage,
  PromoCodeRedemptionResult,
  SubscriptionStatus
} from '../models';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { from, SupabaseDataAccessService } from './supabase-data-access.service';

@Injectable({
  providedIn: 'root'
})
export class PricingDataService extends SupabaseDataAccessService {
  private readonly pricingPlans: Record<PricingPlanKey, { priceGhs: number; monthlyLimit: number | null }> = {
    starter: { priceGhs: 150, monthlyLimit: 40 },
    growth: { priceGhs: 200, monthlyLimit: 120 },
    pro: { priceGhs: 300, monthlyLimit: null }
  };

  constructor(supa: SupabaseService, authService: AuthService) {
    super(supa, authService);
  }

  getPricingUsage(): Observable<PricingUsage> {
    return from(this.fetchPricingUsage());
  }

  redeemPromoCode(code: string): Observable<PromoCodeRedemptionResult> {
    return from(this.redeemPromoCodeAsync(code));
  }

  async assertCanCreateSalesRecord(_recordLabel: 'order' | 'stock sale'): Promise<void> {
    const usage = await this.fetchPricingUsage();
    if (usage.canCreateSalesRecord) return;

    if (!usage.promoActive && usage.status !== 'active') {
      throw new Error('Your 2-month promo has ended. Activate a paid plan to continue creating sales records.');
    }
  }

  private getMonthRange(date = new Date()) {
    const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    return { monthStart, monthEnd };
  }

  private normalizePlan(value: any): PricingPlanKey {
    return value === 'growth' || value === 'pro' ? value : 'starter';
  }

  private normalizeSubscriptionStatus(value: any): SubscriptionStatus {
    return ['promo', 'active', 'past_due', 'suspended', 'cancelled'].includes(value) ? value : 'promo';
  }

  private getRecommendedPlan(usageCount: number): PricingPlanKey {
    if (usageCount <= this.pricingPlans.starter.monthlyLimit!) return 'starter';
    if (usageCount <= this.pricingPlans.growth.monthlyLimit!) return 'growth';
    return 'pro';
  }

  private async redeemPromoCodeAsync(code: string): Promise<PromoCodeRedemptionResult> {
    const shopId = this.activeShopId;
    const normalizedCode = code.trim();

    if (!shopId) {
      throw new Error('Active shop context is required to redeem a promo code.');
    }

    if (!normalizedCode) {
      throw new Error('Enter a promo code.');
    }

    const { data, error } = await (this.sb as any).rpc('redeem_shop_promo_code', {
      p_shop_id: shopId,
      p_code: normalizedCode
    });

    if (error) throw new Error(error.message || 'Could not redeem promo code.');

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('Promo code was not redeemed.');
    }

    return {
      code: row.code,
      description: row.description ?? null,
      extraPromoDays: Number(row.extra_promo_days || 0),
      discountPercent: row.discount_percent ?? null,
      planOverride: this.normalizePlan(row.plan_override) === row.plan_override ? row.plan_override : null,
      promoEndsAt: row.promo_ends_at ?? null
    };
  }

  private async fetchMonthlySalesRecordCount(monthStart: Date, monthEnd: Date): Promise<number> {
    const shopId = this.activeShopId;
    if (!shopId) return 0;

    const [{ count: orderCount, error: orderError }, { count: stockSaleCount, error: stockSaleError }] = await Promise.all([
      this.sb.from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .gte('created_at', monthStart.toISOString())
        .lt('created_at', monthEnd.toISOString()),
      this.sb.from('stock_sales')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .gte('created_at', monthStart.toISOString())
        .lt('created_at', monthEnd.toISOString())
    ]);

    if (orderError) throw orderError;
    if (stockSaleError) throw stockSaleError;

    return Number(orderCount || 0) + Number(stockSaleCount || 0);
  }

  private async fetchPricingUsage(): Promise<PricingUsage> {
    const shopId = this.activeShopId;
    if (!shopId) {
      throw new Error('Active shop context is required to load pricing usage.');
    }

    const { monthStart, monthEnd } = this.getMonthRange();
    const [{ data: shop, error: shopError }, usageCount] = await Promise.all([
      this.sb.from('shops')
        .select('subscription_plan, subscription_status, promo_started_at, promo_ends_at')
        .eq('id', shopId)
        .maybeSingle(),
      this.fetchMonthlySalesRecordCount(monthStart, monthEnd)
    ]);

    if (shopError) throw shopError;

    const plan = this.normalizePlan((shop as any)?.subscription_plan);
    const status = this.normalizeSubscriptionStatus((shop as any)?.subscription_status);
    const planConfig = this.pricingPlans[plan];
    const promoEndsAt = (shop as any)?.promo_ends_at || null;
    const promoActive = status === 'promo' && !!promoEndsAt && new Date(promoEndsAt).getTime() >= Date.now();
    const isActivePaid = status === 'active';
    const remaining = planConfig.monthlyLimit === null
      ? null
      : Math.max(0, planConfig.monthlyLimit - usageCount);
    const overageCount = planConfig.monthlyLimit === null
      ? 0
      : Math.max(0, usageCount - planConfig.monthlyLimit);

    return {
      plan,
      status,
      priceGhs: planConfig.priceGhs,
      monthlyLimit: planConfig.monthlyLimit,
      usageCount,
      remaining,
      overageCount,
      promoStartedAt: (shop as any)?.promo_started_at || null,
      promoEndsAt,
      promoActive,
      canCreateSalesRecord: promoActive || isActivePaid,
      recommendedPlan: this.getRecommendedPlan(usageCount),
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString()
    };
  }
}
