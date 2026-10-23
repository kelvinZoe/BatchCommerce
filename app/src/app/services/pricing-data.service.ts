import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
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
  private readonly monthlyPriceGhs = 100;

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
    const shopId = this.requireActiveShopId();
    const { data, error } = await this.sb.rpc('can_shop_create_sales_record', { p_shop_id: shopId });
    if (error) throw new Error(error.message || 'Could not confirm subscription access.');
    if (data === true) return;
    throw new Error('Your BatchCommerce access has ended. Renew your GHS 100 monthly subscription to continue creating sales records.');
  }

  private getMonthRange(date = new Date()) {
    const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    return { monthStart, monthEnd };
  }

  private normalizeSubscriptionStatus(value: any): SubscriptionStatus {
    return ['promo', 'active', 'past_due', 'suspended', 'cancelled'].includes(value) ? value : 'promo';
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
    const [{ data: shop, error: shopError }, { data: summaryData, error: summaryError }, usageCount] = await Promise.all([
      this.sb.from('shops')
        .select('subscription_status, promo_started_at, promo_ends_at')
        .eq('id', shopId)
        .maybeSingle(),
      this.sb.rpc('get_shop_subscription_summary', { p_shop_id: shopId }),
      this.fetchMonthlySalesRecordCount(monthStart, monthEnd)
    ]);

    if (shopError) throw shopError;
    if (summaryError) throw summaryError;

    const status = this.normalizeSubscriptionStatus((shop as any)?.subscription_status);
    const promoEndsAt = (shop as any)?.promo_ends_at || null;
    const summary = Array.isArray(summaryData) ? summaryData[0] : summaryData;
    const accessState = summary?.access_state || 'blocked';
    const promoActive = accessState === 'promo';

    return {
      status,
      accessState,
      priceGhs: this.monthlyPriceGhs,
      usageCount,
      promoStartedAt: (shop as any)?.promo_started_at || null,
      promoEndsAt,
      promoActive,
      canCreateSalesRecord: !!summary?.can_create_sales_record,
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
      accessEndsAt: summary?.access_ends_at || null,
      graceEndsAt: summary?.grace_ends_at || null,
      daysRemaining: Number(summary?.days_remaining || 0),
      pendingDiscountPercent: summary?.pending_discount_percent ?? null,
      nextAmountMinor: Number(summary?.next_amount_minor ?? 10000)
    };
  }
}
