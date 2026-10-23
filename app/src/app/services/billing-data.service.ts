import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BillingConfig,
  ManualSubscriptionPaymentInput,
  PlatformPromoCode,
  PlatformShop,
  SubscriptionPayment,
  SubscriptionSummary
} from '../models';
import { AuthService } from './auth.service';
import { from, SupabaseDataAccessService, toCamel } from './supabase-data-access.service';
import { SupabaseService } from './supabase.service';

export interface BillingOverview {
  summary: SubscriptionSummary;
  payments: SubscriptionPayment[];
  config: BillingConfig;
}

export interface PlatformAdminOverview {
  shops: PlatformShop[];
  payments: SubscriptionPayment[];
  promoCodes: PlatformPromoCode[];
}

@Injectable({ providedIn: 'root' })
export class BillingDataService extends SupabaseDataAccessService {
  constructor(supa: SupabaseService, authService: AuthService) {
    super(supa, authService);
  }

  getOverview(): Observable<BillingOverview> {
    return from(this.fetchOverview());
  }

  initializePayment(): Observable<any> {
    return from(this.invoke('billing-initialize', { shopId: this.requireActiveShopId() }));
  }

  verifyPayment(reference: string): Observable<any> {
    return from(this.invoke('billing-verify', { reference }));
  }

  submitManualPayment(input: ManualSubscriptionPaymentInput): Observable<any> {
    return from(this.invoke('manual-payment-submit', {
      shopId: this.requireActiveShopId(),
      ...input
    }));
  }

  async isPlatformAdmin(): Promise<boolean> {
    const { data, error } = await this.sb.rpc('is_current_platform_admin', {});
    return !error && data === true;
  }

  getPlatformOverview(): Observable<PlatformAdminOverview> {
    return from(this.invoke('platform-admin', { action: 'overview' }).then(data => ({
      shops: (data.shops || []).map((row: any) => this.mapPlatformShop(row)),
      payments: (data.payments || []).map((row: any) => this.mapPayment(row)),
      promoCodes: (data.promoCodes || []).map((row: any) => toCamel(row) as PlatformPromoCode)
    })));
  }

  reviewManualPayment(paymentId: string, decision: 'approve' | 'reject', note: string): Observable<any> {
    return from(this.invoke('manual-payment-review', { paymentId, decision, note }));
  }

  setShopStatus(shopId: string, status: string, reason: string): Observable<any> {
    return from(this.invoke('platform-admin', { action: 'set_shop_status', shopId, status, reason }));
  }

  grantShopAccess(shopId: string, days: number, reason: string): Observable<any> {
    return from(this.invoke('platform-admin', { action: 'grant_access', shopId, days, reason }));
  }

  savePromoCode(promo: Record<string, unknown>, promoId?: string): Observable<any> {
    return from(this.invoke('platform-admin', { action: 'save_promo', promo, promoId }));
  }

  togglePromoCode(promoId: string): Observable<any> {
    return from(this.invoke('platform-admin', { action: 'toggle_promo', promoId }));
  }

  private async fetchOverview(): Promise<BillingOverview> {
    const shopId = this.requireActiveShopId();
    const [summaryResult, paymentsResult, config] = await Promise.all([
      this.sb.rpc('get_shop_subscription_summary', { p_shop_id: shopId }),
      this.sb.from('subscription_payments').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }),
      this.invoke('billing-config', {})
    ]);

    if (summaryResult.error) throw new Error(summaryResult.error.message || 'Could not load subscription status.');
    if (paymentsResult.error) throw new Error(paymentsResult.error.message || 'Could not load payment history.');
    const summaryRow = Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data;
    if (!summaryRow) throw new Error('Subscription status is unavailable.');

    return {
      summary: toCamel(summaryRow) as SubscriptionSummary,
      payments: (paymentsResult.data || []).map(row => this.mapPayment(row)),
      config: config as BillingConfig
    };
  }

  private async invoke(functionName: string, body: Record<string, unknown>): Promise<any> {
    const { data, error } = await this.sb.functions.invoke(functionName, { body });
    if (error) {
      let message = error.message || `Could not call ${functionName}.`;
      const response = (error as any)?.context;
      if (response && typeof response.clone === 'function') {
        try {
          const details = await response.clone().json();
          message = details?.error || details?.message || message;
        } catch {
          // Keep the SDK error when the response body is not JSON.
        }
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data || {};
  }

  private mapPayment(row: any): SubscriptionPayment {
    return {
      ...(toCamel(row) as SubscriptionPayment),
      shops: row.shops || null
    };
  }

  private mapPlatformShop(row: any): PlatformShop {
    return {
      ...(toCamel(row) as PlatformShop),
      subscriptionSummary: toCamel(row.subscription_summary || {}) as SubscriptionSummary
    };
  }
}
