import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BillingOverview, BillingDataService } from '../../services/billing-data.service';
import { AuthService } from '../../services/auth.service';
import { DatabaseService } from '../../services/database.service';
import { ManualSubscriptionPaymentInput, PromoCodeRedemptionResult, SubscriptionPayment } from '../../models';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription.component.html',
  styleUrls: ['./subscription.component.scss']
})
export class SubscriptionComponent implements OnInit {
  overview: BillingOverview | null = null;
  loading = true;
  onlinePaymentLoading = false;
  verifyingPayment = false;
  manualSubmitting = false;
  applyingPromoCode = false;
  showManualForm = false;
  error = '';
  success = '';
  promoCode = '';
  promoMessage = '';

  manualPayment: ManualSubscriptionPaymentInput = {
    senderName: '',
    senderPhone: '',
    network: 'mtn',
    transactionReference: '',
    paidAt: this.localDateTimeValue(new Date())
  };

  constructor(
    private billing: BillingDataService,
    private db: DatabaseService,
    private auth: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const reference = this.route.snapshot.queryParamMap.get('payment_reference')
      || this.route.snapshot.queryParamMap.get('reference')
      || this.route.snapshot.queryParamMap.get('trxref');
    if (reference) {
      this.verifyReturnedPayment(reference);
      return;
    }
    this.loadOverview();
  }

  loadOverview(preserveMessage = false): void {
    this.loading = true;
    if (!preserveMessage) { this.error = ''; this.success = ''; }
    this.billing.getOverview().subscribe({
      next: overview => { this.overview = overview; this.loading = false; },
      error: error => { this.error = error?.message || 'Could not load subscription billing.'; this.loading = false; }
    });
  }

  payOnline(): void {
    if (!this.canMakePayments || this.onlinePaymentLoading) return;
    this.onlinePaymentLoading = true;
    this.clearMessages();
    this.billing.initializePayment().subscribe({
      next: result => {
        if (result.completed) {
          this.onlinePaymentLoading = false;
          this.success = 'Your free renewal was applied successfully.';
          this.loadOverview(true);
          return;
        }
        if (!result.authorizationUrl) {
          this.onlinePaymentLoading = false;
          this.error = 'Paystack did not return a checkout link.';
          return;
        }
        window.location.assign(result.authorizationUrl);
      },
      error: error => { this.onlinePaymentLoading = false; this.error = error?.message || 'Could not start online payment.'; }
    });
  }

  submitManualPayment(): void {
    if (!this.canMakePayments || this.manualSubmitting) return;
    this.manualSubmitting = true;
    this.clearMessages();
    const input = { ...this.manualPayment, paidAt: new Date(this.manualPayment.paidAt).toISOString() };
    this.billing.submitManualPayment(input).subscribe({
      next: () => {
        this.manualSubmitting = false;
        this.showManualForm = false;
        this.success = 'Payment submitted. We will verify the MoMo reference and update your access.';
        this.manualPayment = { senderName: '', senderPhone: '', network: 'mtn', transactionReference: '', paidAt: this.localDateTimeValue(new Date()) };
        this.loadOverview(true);
      },
      error: error => { this.manualSubmitting = false; this.error = error?.message || 'Could not submit manual payment.'; }
    });
  }

  applyPromoCode(): void {
    const code = this.promoCode.trim();
    if (!code || this.applyingPromoCode) return;
    this.applyingPromoCode = true;
    this.promoMessage = '';
    this.clearMessages();
    this.db.redeemPromoCode(code).subscribe({
      next: result => {
        this.applyingPromoCode = false;
        this.promoCode = '';
        this.promoMessage = this.promoSuccessMessage(result);
        this.loadOverview(true);
      },
      error: error => { this.applyingPromoCode = false; this.error = error?.message || 'Could not apply promo code.'; }
    });
  }

  private verifyReturnedPayment(reference: string): void {
    this.verifyingPayment = true;
    this.loading = true;
    this.billing.verifyPayment(reference).subscribe({
      next: () => {
        this.verifyingPayment = false;
        this.success = 'Payment confirmed. Your next month has been added.';
        history.replaceState({}, '', location.pathname);
        this.loadOverview(true);
      },
      error: error => {
        this.verifyingPayment = false;
        this.error = error?.message || 'We could not confirm this payment yet. Refresh to try again.';
        this.loadOverview(true);
      }
    });
  }

  private promoSuccessMessage(result: PromoCodeRedemptionResult): string {
    const parts = [`${result.code} applied.`];
    if (result.extraPromoDays > 0) parts.push(`${result.extraPromoDays} promo days were added.`);
    if (result.discountPercent !== null && result.discountPercent > 0) parts.push(`${result.discountPercent}% will be taken off your next successful renewal.`);
    return parts.join(' ');
  }

  private clearMessages(): void { this.error = ''; this.success = ''; }

  private localDateTimeValue(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  get canMakePayments(): boolean { return this.auth.can('create', 'billing'); }
  get summary() { return this.overview?.summary || null; }

  get stateLabel(): string {
    const labels: Record<string, string> = { promo: 'Free period', active: 'Active', grace: 'Grace period', blocked: 'Read-only', suspended: 'Suspended', cancelled: 'Cancelled' };
    return labels[this.summary?.accessState || ''] || 'Unavailable';
  }

  get stateCopy(): string {
    switch (this.summary?.accessState) {
      case 'promo': return 'Your free access is active. A paid month will begin after it ends.';
      case 'active': return 'Every BatchCommerce feature is available to this shop.';
      case 'grace': return `Renew before ${this.dateLabel(this.summary.graceEndsAt)} to avoid read-only access.`;
      case 'blocked': return 'Existing records remain available, but new orders and stock sales are paused.';
      case 'suspended': return 'Contact BatchCommerce Support to resolve this suspension.';
      case 'cancelled': return 'Billing has been cancelled for this workspace.';
      default: return 'We could not determine the current access state.';
    }
  }

  get nextChargeGhs(): number { return Number(this.summary?.nextAmountMinor ?? 10000) / 100; }
  get manualPaymentConfigured(): boolean { return !!this.overview?.config.manualPayment.number; }
  amountGhs(payment: SubscriptionPayment): number { return Number(payment.amountMinor || 0) / 100; }
  paymentLabel(payment: SubscriptionPayment): string {
    if (payment.source === 'manual') return 'Manual MoMo';
    if (payment.amountMinor === 0) return 'Promo renewal';
    return payment.channel === 'mobile_money' ? 'Paystack MoMo' : 'Paystack';
  }
  dateLabel(value: string | null | undefined): string {
    return value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';
  }
  trackPayment(_: number, payment: SubscriptionPayment): string { return payment.id; }
}
