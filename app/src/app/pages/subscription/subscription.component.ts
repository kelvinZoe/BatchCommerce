import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { PricingUsage, PromoCodeRedemptionResult } from '../../models';

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
            One simple subscription gives every shop the same complete BatchCommerce experience.
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
            <span class="sub-label">Monthly subscription</span>
            <strong>GHS {{ usage.priceGhs }}</strong>
            <p>One flat fee every month.</p>
          </article>

          <article class="sub-status-card">
            <span class="sub-label">Subscription status</span>
            <strong>{{ statusLabel }}</strong>
            <p>{{ statusMessage }}</p>
          </article>

          <article class="sub-status-card">
            <span class="sub-label">Access</span>
            <strong>All features</strong>
            <p>Unlimited sales records for shops of every size.</p>
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

          <div class="sub-flat-mark">
            <span class="material-icons">all_inclusive</span>
            <strong>No limits</strong>
            <small>Same monthly price</small>
          </div>
        </section>

        <section class="sub-promo-card">
          <div class="sub-promo-copy">
            <span class="sub-kicker">Promo code</span>
            <h2>Add a promotion</h2>
            <p>Apply a code to extend the promo window or record a discount on the flat subscription.</p>
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

    .sub-status-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 16px;
    }

    .sub-status-card,
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

    .sub-flat-mark {
      width: 170px;
      height: 170px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 4px;
      justify-self: end;
      color: #fff;
      background: linear-gradient(145deg, var(--sub-green), #115e59);
      box-shadow: 0 18px 38px rgba(15, 118, 110, 0.2);
      text-align: center;
    }

    .sub-flat-mark .material-icons {
      font-size: 34px;
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

    .sub-flat-mark strong {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.05em;
    }

    .sub-flat-mark small {
      color: rgba(255, 255, 255, 0.74);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
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
      .sub-usage-shell,
      .sub-promo-card {
        grid-template-columns: 1fr;
      }

      .sub-flat-mark {
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

      .sub-flat-mark {
        width: 150px;
        height: 150px;
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
    return 'Activate your GHS 70 monthly subscription to keep creating sales records.';
  }

  get usageSummary(): string {
    if (!this.usage) return '';
    return 'Usage is shown for your records only. It does not change your GHS 70 monthly price.';
  }

  get nextActionTitle(): string {
    if (!this.usage) return 'Review subscription';
    if (!this.usage.promoActive && this.usage.status !== 'active') return 'Activate billing';
    return 'No action needed';
  }

  get nextActionCopy(): string {
    if (!this.usage) return 'Load subscription usage to see your next step.';
    if (!this.usage.promoActive && this.usage.status !== 'active') {
      return 'The shop can view data, but new orders and stock sales need an active paid subscription.';
    }
    return 'Your subscription has no usage tiers or feature limits.';
  }
}
