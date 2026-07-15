import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { PricingPlanKey, PricingUsage, PromoCodeRedemptionResult } from '../../models';

interface PlanBand {
  key: PricingPlanKey;
  name: string;
  price: number;
  range: string;
  description: string;
}

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="sub-page">
      <section class="sub-hero">
        <div class="sub-orbit sub-orbit-a"></div>
        <div class="sub-orbit sub-orbit-b"></div>
        <div class="sub-hero-copy">
          <span class="sub-kicker">Subscription health</span>
          <h1>Know exactly where your shop stands.</h1>
          <p>
            Track your promo, paid status, monthly sales records, and the plan band your current activity belongs to.
          </p>
        </div>
        <button class="sub-refresh" type="button" (click)="loadUsage()" [disabled]="loading">
          <span class="material-icons" [class.spin]="loading">sync</span>
          Refresh
        </button>
      </section>

      <div class="sub-alert sub-alert-error" *ngIf="error">
        <span class="material-icons">error_outline</span>
        <span>{{ error }}</span>
      </div>

      <section class="sub-loading-card" *ngIf="loading && !usage">
        <div class="sub-glow-line"></div>
        <div class="sub-glow-line short"></div>
        <div class="sub-glow-grid">
          <span *ngFor="let item of [1,2,3,4,5,6]"></span>
        </div>
      </section>

      <ng-container *ngIf="usage">
        <section class="sub-status-grid">
          <article class="sub-status-card primary">
            <span class="sub-label">Current plan</span>
            <strong>{{ usage.plan | titlecase }}</strong>
            <p>GHS {{ usage.priceGhs }} / month</p>
          </article>

          <article class="sub-status-card">
            <span class="sub-label">Subscription status</span>
            <strong>{{ statusLabel }}</strong>
            <p>{{ statusMessage }}</p>
          </article>

          <article class="sub-status-card">
            <span class="sub-label">Recommended band</span>
            <strong>{{ usage.recommendedPlan | titlecase }}</strong>
            <p>{{ recommendationMessage }}</p>
          </article>
        </section>

        <section class="sub-usage-shell">
          <div class="sub-usage-copy">
            <span class="sub-kicker">This month</span>
            <h2>{{ usage.usageCount }} sales records</h2>
            <p>{{ usageSummary }}</p>
            <div class="sub-window">
              <span>{{ usage.monthStart | date:'mediumDate' }}</span>
              <span class="material-icons">arrow_forward</span>
              <span>{{ usage.monthEnd | date:'mediumDate' }}</span>
            </div>
          </div>

          <div class="sub-gauge" [style.--usage-angle]="usageAngle + 'deg'">
            <div class="sub-gauge-inner">
              <span>{{ usagePercentLabel }}</span>
              <small>{{ usage.monthlyLimit === null ? 'Unlimited' : 'of band' }}</small>
            </div>
          </div>
        </section>

        <section class="sub-promo-card">
          <div class="sub-promo-copy">
            <span class="sub-kicker">Promo code</span>
            <h2>Add a promotion</h2>
            <p>Apply a code to extend the promo window or record a billing discount for this shop.</p>
            <div class="sub-promo-message success" *ngIf="promoCodeSuccess">
              <span class="material-icons">check_circle</span>
              <span>{{ promoCodeSuccess }}</span>
            </div>
            <div class="sub-promo-message error" *ngIf="promoCodeError">
              <span class="material-icons">error_outline</span>
              <span>{{ promoCodeError }}</span>
            </div>
          </div>

          <form class="sub-promo-form" (ngSubmit)="applyPromoCode()">
            <input
              name="promoCode"
              type="text"
              placeholder="PROMO2026"
              autocomplete="off"
              [(ngModel)]="promoCode"
              [disabled]="applyingPromoCode"
            >
            <button type="submit" [disabled]="applyingPromoCode || !promoCode.trim()">
              <span class="material-icons" [class.spin]="applyingPromoCode">local_activity</span>
              {{ applyingPromoCode ? 'Applying' : 'Apply code' }}
            </button>
          </form>
        </section>

        <section class="sub-plan-row">
          <article
            *ngFor="let plan of planBands"
            class="sub-plan-card"
            [class.active]="plan.key === usage.plan"
            [class.recommended]="plan.key === usage.recommendedPlan">
            <div class="sub-plan-top">
              <span class="material-icons">{{ planIcon(plan.key) }}</span>
              <span *ngIf="plan.key === usage.plan">Current</span>
              <span *ngIf="plan.key !== usage.plan && plan.key === usage.recommendedPlan">Recommended</span>
            </div>
            <h3>{{ plan.name }}</h3>
            <strong>GHS {{ plan.price }}<small>/mo</small></strong>
            <p>{{ plan.range }}</p>
            <em>{{ plan.description }}</em>
          </article>
        </section>

        <section class="sub-next-card">
          <div>
            <span class="sub-kicker">Next action</span>
            <h2>{{ nextActionTitle }}</h2>
            <p>{{ nextActionCopy }}</p>
          </div>
          <a routerLink="/settings" class="sub-settings-link">
            Open Settings
            <span class="material-icons">arrow_forward</span>
          </a>
        </section>
      </ng-container>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --sub-ink: #172033;
      --sub-muted: #64748b;
      --sub-line: #dbe3ef;
      --sub-paper: #fffdf7;
      --sub-cream: #f7f1e4;
      --sub-green: #0f766e;
      --sub-amber: #c77913;
      --sub-coral: #d94a38;
    }

    .sub-page {
      min-height: calc(100vh - 48px);
      color: var(--sub-ink);
      background:
        radial-gradient(circle at 10% 0%, rgba(15, 118, 110, 0.18), transparent 34%),
        radial-gradient(circle at 90% 14%, rgba(217, 74, 56, 0.16), transparent 32%),
        linear-gradient(135deg, #fbf6ea 0%, #f8fafc 48%, #eef6f4 100%);
      border-radius: 24px;
      padding: 18px;
      overflow: hidden;
    }

    .sub-hero {
      position: relative;
      display: flex;
      justify-content: space-between;
      gap: 20px;
      min-height: 190px;
      padding: 28px 32px;
      border: 1px solid rgba(23, 32, 51, 0.12);
      border-radius: 24px;
      background:
        linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,253,247,0.62)),
        repeating-linear-gradient(90deg, rgba(23,32,51,0.045) 0 1px, transparent 1px 34px);
      overflow: hidden;
      animation: sub-rise 0.45s ease-out both;
    }

    .sub-hero-copy {
      position: relative;
      z-index: 1;
      max-width: 560px;
    }

    .sub-kicker,
    .sub-label {
      display: inline-flex;
      color: var(--sub-green);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .sub-hero h1 {
      max-width: 590px;
      margin: 10px 0 10px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: clamp(30px, 4.4vw, 54px);
      line-height: 0.96;
      letter-spacing: -0.055em;
    }

    .sub-hero p,
    .sub-next-card p,
    .sub-usage-copy p {
      max-width: 620px;
      margin: 0;
      color: var(--sub-muted);
      font-size: 13px;
      line-height: 1.55;
    }

    .sub-orbit {
      position: absolute;
      border: 1px solid rgba(23, 32, 51, 0.16);
      border-radius: 999px;
      pointer-events: none;
    }

    .sub-orbit-a {
      width: 240px;
      height: 240px;
      right: 88px;
      top: -84px;
      background: rgba(15, 118, 110, 0.08);
    }

    .sub-orbit-b {
      width: 360px;
      height: 360px;
      right: -145px;
      bottom: -188px;
      background: rgba(199, 121, 19, 0.08);
    }

    .sub-refresh,
    .sub-settings-link {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 42px;
      padding: 0 15px;
      border: 1px solid rgba(23, 32, 51, 0.14);
      border-radius: 999px;
      background: var(--sub-ink);
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
    }

    .sub-refresh:disabled {
      opacity: 0.65;
      cursor: default;
    }

    .sub-status-grid,
    .sub-plan-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 16px;
    }

    .sub-status-card,
    .sub-plan-card,
    .sub-usage-shell,
    .sub-promo-card,
    .sub-next-card,
    .sub-loading-card,
    .sub-alert {
      border: 1px solid rgba(23, 32, 51, 0.12);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.76);
      backdrop-filter: blur(10px);
    }

    .sub-status-card {
      padding: 18px;
      animation: sub-rise 0.5s ease-out both;
    }

    .sub-status-card.primary {
      background: var(--sub-ink);
      color: #fff;
    }

    .sub-status-card.primary .sub-label,
    .sub-status-card.primary p {
      color: rgba(255,255,255,0.72);
    }

    .sub-status-card strong {
      display: block;
      margin-top: 10px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 24px;
      line-height: 1;
      text-transform: capitalize;
    }

    .sub-status-card p {
      margin: 10px 0 0;
      color: var(--sub-muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .sub-usage-shell {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 190px;
      align-items: center;
      gap: 20px;
      margin-top: 16px;
      padding: 22px 24px;
    }

    .sub-usage-copy h2,
    .sub-next-card h2 {
      margin: 9px 0 8px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: clamp(25px, 3.2vw, 38px);
      line-height: 1;
      letter-spacing: -0.04em;
    }

    .sub-window {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding: 7px 11px;
      border-radius: 999px;
      background: rgba(15, 118, 110, 0.09);
      color: var(--sub-green);
      font-size: 11px;
      font-weight: 800;
    }

    .sub-window .material-icons {
      font-size: 14px;
    }

    .sub-gauge {
      width: 170px;
      height: 170px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      justify-self: end;
      background:
        conic-gradient(var(--sub-green) 0deg, var(--sub-amber) var(--usage-angle), rgba(23,32,51,0.1) var(--usage-angle) 360deg);
    }

    .sub-gauge-inner {
      width: 114px;
      height: 114px;
      display: grid;
      place-items: center;
      align-content: center;
      border-radius: 50%;
      background: var(--sub-paper);
      text-align: center;
    }

    .sub-promo-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
      align-items: center;
      gap: 18px;
      margin-top: 16px;
      padding: 18px;
      background:
        linear-gradient(135deg, rgba(15,118,110,0.08), rgba(255,255,255,0.74)),
        rgba(255, 255, 255, 0.76);
    }

    .sub-promo-copy h2 {
      margin: 8px 0 6px;
      font-size: 19px;
      letter-spacing: -0.02em;
    }

    .sub-promo-copy p {
      margin: 0;
      color: var(--sub-muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .sub-promo-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      padding: 8px;
      border: 1px solid rgba(23,32,51,0.12);
      border-radius: 18px;
      background: rgba(255,255,255,0.7);
    }

    .sub-promo-form input {
      min-width: 0;
      height: 42px;
      padding: 0 13px;
      border: 1px solid rgba(23,32,51,0.12);
      border-radius: 13px;
      background: #fff;
      color: var(--sub-ink);
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      outline: none;
    }

    .sub-promo-form input:focus {
      border-color: rgba(15,118,110,0.58);
    }

    .sub-promo-form button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      min-width: 126px;
      height: 42px;
      padding: 0 14px;
      border: 1px solid rgba(15,118,110,0.2);
      border-radius: 13px;
      background: var(--sub-green);
      color: #fff;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
    }

    .sub-promo-form button:disabled {
      opacity: 0.58;
      cursor: default;
    }

    .sub-promo-form .material-icons {
      font-size: 18px;
    }

    .sub-promo-message {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin-top: 10px;
      padding: 7px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
    }

    .sub-promo-message .material-icons {
      font-size: 15px;
    }

    .sub-promo-message.success {
      color: #0f766e;
      background: rgba(15, 118, 110, 0.1);
    }

    .sub-promo-message.error {
      color: #991b1b;
      background: rgba(254, 226, 226, 0.8);
    }

    .sub-gauge-inner span {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.05em;
    }

    .sub-gauge-inner small {
      color: var(--sub-muted);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .sub-plan-card {
      position: relative;
      padding: 17px;
      overflow: hidden;
    }

    .sub-plan-card.active {
      border-color: rgba(15, 118, 110, 0.5);
    }

    .sub-plan-card.recommended:not(.active) {
      border-color: rgba(199, 121, 19, 0.48);
    }

    .sub-plan-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 26px;
      color: var(--sub-green);
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

      .sub-plan-top .material-icons {
      font-size: 20px;
    }

    .sub-plan-card h3 {
      margin: 16px 0 6px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 22px;
    }

    .sub-plan-card strong {
      display: block;
      font-size: 19px;
    }

    .sub-plan-card strong small {
      color: var(--sub-muted);
      font-size: 12px;
    }

    .sub-plan-card p {
      margin: 10px 0;
      color: var(--sub-green);
      font-size: 13px;
      font-weight: 900;
    }

    .sub-plan-card em {
      color: var(--sub-muted);
      font-size: 12px;
      line-height: 1.5;
      font-style: normal;
    }

    .sub-next-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-top: 16px;
      padding: 22px;
      background:
        linear-gradient(135deg, rgba(23,32,51,0.94), rgba(15, 118, 110, 0.88)),
        var(--sub-ink);
      color: #fff;
    }

    .sub-next-card .sub-kicker,
    .sub-next-card p {
      color: rgba(255,255,255,0.74);
    }

    .sub-settings-link {
      flex-shrink: 0;
      background: #fff;
      color: var(--sub-ink);
    }

    .sub-loading-card {
      margin-top: 18px;
      padding: 22px;
    }

    .sub-glow-line,
    .sub-glow-grid span {
      height: 18px;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(23,32,51,0.06), rgba(23,32,51,0.13), rgba(23,32,51,0.06));
      background-size: 220% 100%;
      animation: sub-shimmer 1.2s linear infinite;
    }

    .sub-glow-line {
      max-width: 520px;
      margin-bottom: 12px;
    }

    .sub-glow-line.short {
      max-width: 310px;
    }

    .sub-glow-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 22px;
    }

    .sub-glow-grid span {
      height: 92px;
      border-radius: 18px;
    }

    .sub-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding: 14px 16px;
      color: #991b1b;
      background: rgba(254, 242, 242, 0.86);
    }

    .spin {
      animation: sub-spin 0.8s linear infinite;
    }

    @keyframes sub-rise {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes sub-shimmer {
      to { background-position: -220% 0; }
    }

    @keyframes sub-spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 980px) {
      .sub-status-grid,
      .sub-plan-row,
      .sub-usage-shell,
      .sub-promo-card {
        grid-template-columns: 1fr;
      }

      .sub-gauge {
        justify-self: center;
      }
    }

    @media (max-width: 640px) {
      .sub-page {
        padding: 12px;
        border-radius: 20px;
      }

      .sub-hero,
      .sub-next-card {
        flex-direction: column;
        align-items: stretch;
        padding: 20px;
      }

      .sub-refresh,
      .sub-settings-link,
      .sub-promo-form button {
        width: 100%;
      }

      .sub-promo-form {
        grid-template-columns: 1fr;
      }

      .sub-gauge {
        width: 150px;
        height: 150px;
      }

      .sub-gauge-inner {
        width: 100px;
        height: 100px;
      }
    }
  `]
})
export class SubscriptionComponent implements OnInit {
  usage: PricingUsage | null = null;
  loading = true;
  error = '';
  promoCode = '';
  promoCodeSuccess = '';
  promoCodeError = '';
  applyingPromoCode = false;

  readonly planBands: PlanBand[] = [
    { key: 'starter', name: 'Starter', price: 150, range: '0-40 sales records', description: 'A practical base for smaller preorder and stock-sale operations.' },
    { key: 'growth', name: 'Growth', price: 200, range: '41-120 sales records', description: 'For active sellers with regular drops and more frequent in-stock sales.' },
    { key: 'pro', name: 'Pro', price: 300, range: '121+ sales records', description: 'For higher-volume teams that need room to keep moving without friction.' }
  ];

  constructor(private db: DatabaseService) {}

  ngOnInit() {
    this.loadUsage();
  }

  loadUsage() {
    this.loading = true;
    this.error = '';
    this.db.getPricingUsage().subscribe({
      next: usage => {
        this.usage = usage;
        this.loading = false;
      },
      error: err => {
        this.error = err?.message || 'Could not load subscription status.';
        this.loading = false;
      }
    });
  }

  applyPromoCode() {
    const code = this.promoCode.trim();
    if (!code || this.applyingPromoCode) return;

    this.applyingPromoCode = true;
    this.promoCodeSuccess = '';
    this.promoCodeError = '';

    this.db.redeemPromoCode(code).subscribe({
      next: result => {
        this.promoCodeSuccess = this.buildPromoSuccessMessage(result);
        this.promoCode = '';
        this.applyingPromoCode = false;
        this.loadUsage();
      },
      error: err => {
        this.promoCodeError = err?.message || 'Could not apply promo code.';
        this.applyingPromoCode = false;
      }
    });
  }

  private buildPromoSuccessMessage(result: PromoCodeRedemptionResult): string {
    const endsAt = result.promoEndsAt ? new Date(result.promoEndsAt).toLocaleDateString() : '';
    if (result.extraPromoDays > 0 && endsAt) {
      return `${result.code} applied. Promo now ends ${endsAt}.`;
    }
    if (result.discountPercent !== null) {
      return `${result.code} applied. ${result.discountPercent}% discount saved for billing.`;
    }
    if (result.planOverride) {
      return `${result.code} applied. Plan band updated to ${result.planOverride}.`;
    }
    return `${result.code} applied.`;
  }

  get statusLabel(): string {
    if (!this.usage) return 'Loading';
    if (this.usage.promoActive) return 'Promo active';
    return this.usage.status.replace('_', ' ');
  }

  get statusMessage(): string {
    if (!this.usage) return '';
    if (this.usage.promoActive) {
      return `Free promo ends ${new Date(this.usage.promoEndsAt || '').toLocaleDateString()}.`;
    }
    if (this.usage.status === 'active') return 'Paid subscription is active.';
    return 'Activate a paid plan to keep creating sales records.';
  }

  get recommendationMessage(): string {
    if (!this.usage) return '';
    if (this.usage.recommendedPlan === this.usage.plan) return 'Your current plan matches this month’s activity.';
    return `This month’s activity fits ${this.usage.recommendedPlan}.`;
  }

  get usageSummary(): string {
    if (!this.usage) return '';
    if (this.usage.monthlyLimit === null) return 'You are in the Pro band with no upper usage ceiling.';
    if (this.usage.overageCount > 0) {
      return `${this.usage.overageCount} records over the ${this.usage.plan} band. Sales are still allowed; use this as an upgrade signal.`;
    }
    return `${this.usage.remaining} records remain before you exceed this plan band.`;
  }

  get usageAngle(): number {
    if (!this.usage?.monthlyLimit) return 360;
    return Math.min(360, Math.round((this.usage.usageCount / this.usage.monthlyLimit) * 360));
  }

  get usagePercentLabel(): string {
    if (!this.usage?.monthlyLimit) return '∞';
    return `${Math.min(999, Math.round((this.usage.usageCount / this.usage.monthlyLimit) * 100))}%`;
  }

  get nextActionTitle(): string {
    if (!this.usage) return 'Review subscription';
    if (!this.usage.promoActive && this.usage.status !== 'active') return 'Activate billing';
    if (this.usage.recommendedPlan !== this.usage.plan) return `Move toward ${this.usage.recommendedPlan}`;
    return 'No action needed';
  }

  get nextActionCopy(): string {
    if (!this.usage) return 'Load subscription usage to see your next step.';
    if (!this.usage.promoActive && this.usage.status !== 'active') {
      return 'The shop can view data, but new orders and stock sales need an active paid subscription.';
    }
    if (this.usage.recommendedPlan !== this.usage.plan) {
      return 'Overages are allowed, but this recommendation helps keep billing aligned with real usage.';
    }
    return 'Your current plan, status, and monthly usage are aligned.';
  }

  planIcon(plan: PricingPlanKey): string {
    if (plan === 'pro') return 'rocket_launch';
    if (plan === 'growth') return 'trending_up';
    return 'storefront';
  }
}
