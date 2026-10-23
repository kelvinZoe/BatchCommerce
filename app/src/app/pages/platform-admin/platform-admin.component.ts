import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlatformPromoCode, PlatformShop, SubscriptionPayment } from '../../models';
import { AuthService } from '../../services/auth.service';
import { BillingDataService, PlatformAdminOverview } from '../../services/billing-data.service';

type AdminTab = 'shops' | 'payments' | 'promos';

@Component({
  selector: 'app-platform-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './platform-admin.component.html',
  styleUrls: ['./platform-admin.component.scss']
})
export class PlatformAdminComponent implements OnInit {
  overview: PlatformAdminOverview = { shops: [], payments: [], promoCodes: [] };
  loading = true;
  error = '';
  success = '';
  search = '';
  activeTab: AdminTab = 'shops';
  busyId = '';
  reviewNotes: Record<string, string> = {};
  shopReasons: Record<string, string> = {};
  grantDays: Record<string, number> = {};
  showPromoForm = false;
  promoForm = {
    code: '', description: '', extraPromoDays: 0, discountPercent: null as number | null,
    maxRedemptions: null as number | null, startsAt: '', expiresAt: '', isActive: true
  };

  constructor(private billing: BillingDataService, private auth: AuthService, private router: Router) {}

  ngOnInit(): void { this.load(); }

  load(preserveMessage = false): void {
    this.loading = true;
    this.error = '';
    if (!preserveMessage) this.success = '';
    this.billing.getPlatformOverview().subscribe({
      next: overview => { this.overview = overview; this.loading = false; },
      error: error => { this.error = error?.message || 'Could not load the platform console.'; this.loading = false; }
    });
  }

  setTab(tab: AdminTab): void { this.activeTab = tab; this.search = ''; }

  review(payment: SubscriptionPayment, decision: 'approve' | 'reject'): void {
    const note = (this.reviewNotes[payment.id] || '').trim();
    if (decision === 'reject' && note.length < 3) { this.error = 'Add a reason before rejecting a payment.'; return; }
    this.run(payment.id, this.billing.reviewManualPayment(payment.id, decision, note),
      decision === 'approve' ? 'Payment approved and one month added.' : 'Payment rejected.');
  }

  changeShopStatus(shop: PlatformShop, status: string): void {
    const reason = (this.shopReasons[shop.id] || '').trim();
    if (reason.length < 3) { this.error = 'Add a reason before changing a shop status.'; return; }
    this.run(shop.id, this.billing.setShopStatus(shop.id, status, reason), 'Shop subscription status updated.');
  }

  grantAccess(shop: PlatformShop): void {
    const days = Number(this.grantDays[shop.id] || 30);
    const reason = (this.shopReasons[shop.id] || '').trim();
    if (reason.length < 3) { this.error = 'Add a reason before granting access.'; return; }
    this.run(shop.id, this.billing.grantShopAccess(shop.id, days, reason), `${days} days added to ${shop.name}.`);
  }

  savePromo(): void {
    if (!this.promoForm.code.trim()) { this.error = 'Promo code is required.'; return; }
    this.run('promo-form', this.billing.savePromoCode({
      ...this.promoForm,
      startsAt: this.promoForm.startsAt ? new Date(this.promoForm.startsAt).toISOString() : null,
      expiresAt: this.promoForm.expiresAt ? new Date(this.promoForm.expiresAt).toISOString() : null
    }), 'Promo code saved.');
  }

  togglePromo(promo: PlatformPromoCode): void {
    this.run(promo.id, this.billing.togglePromoCode(promo.id), `${promo.code} ${promo.isActive ? 'deactivated' : 'activated'}.`);
  }

  private run(id: string, operation: any, message: string): void {
    if (this.busyId) return;
    this.busyId = id;
    this.error = '';
    this.success = '';
    operation.subscribe({
      next: () => { this.busyId = ''; this.success = message; this.showPromoForm = false; this.resetPromoForm(); this.load(true); },
      error: (error: any) => { this.busyId = ''; this.error = error?.message || 'The platform action failed.'; }
    });
  }

  private resetPromoForm(): void {
    this.promoForm = { code: '', description: '', extraPromoDays: 0, discountPercent: null, maxRedemptions: null, startsAt: '', expiresAt: '', isActive: true };
  }

  get filteredShops(): PlatformShop[] {
    const term = this.search.trim().toLowerCase();
    return term ? this.overview.shops.filter(shop => `${shop.name} ${shop.slug} ${shop.subscriptionSummary.accessState}`.toLowerCase().includes(term)) : this.overview.shops;
  }

  get filteredPayments(): SubscriptionPayment[] {
    const term = this.search.trim().toLowerCase();
    return term ? this.overview.payments.filter(payment => `${payment.shops?.name || ''} ${payment.providerReference || ''} ${payment.manualReference || ''} ${payment.status}`.toLowerCase().includes(term)) : this.overview.payments;
  }

  get pendingManualPayments(): SubscriptionPayment[] { return this.overview.payments.filter(payment => payment.source === 'manual' && payment.status === 'pending_review'); }
  get activeShopCount(): number { return this.overview.shops.filter(shop => ['active', 'promo', 'grace'].includes(shop.subscriptionSummary.accessState)).length; }
  get collectedGhs(): number { return this.overview.payments.filter(payment => payment.status === 'successful').reduce((sum, payment) => sum + Number(payment.amountMinor || 0), 0) / 100; }
  nextChargeGhs(shop: PlatformShop): number { return Number(shop.subscriptionSummary.nextAmountMinor ?? 10000) / 100; }
  amountGhs(payment: SubscriptionPayment): number { return Number(payment.amountMinor || 0) / 100; }
  dateLabel(value: string | null | undefined): string { return value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
  goToWorkspace(): void { this.router.navigate(['/dashboard']); }
  logout(): void { this.auth.logout(); this.router.navigate(['/login']); }
  trackById(_: number, item: { id: string }): string { return item.id; }
}
