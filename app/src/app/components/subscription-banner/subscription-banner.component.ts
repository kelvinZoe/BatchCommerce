import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SubscriptionSummary } from '../../models';
import { AuthService } from '../../services/auth.service';
import { BillingDataService } from '../../services/billing-data.service';

@Component({
  selector: 'app-subscription-banner',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <aside class="billing-notice" *ngIf="visible" [class.urgent]="summary?.accessState === 'blocked'" [class.grace]="summary?.accessState === 'grace'">
      <span class="material-icons">{{ icon }}</span>
      <div>
        <strong>{{ title }}</strong>
        <span>{{ message }}</span>
      </div>
      <a routerLink="/subscription">Review subscription <span class="material-icons">arrow_forward</span></a>
    </aside>
  `,
  styles: [`
    :host { display: block; }
    .billing-notice {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      margin: 0 0 14px;
      padding: 12px 15px;
      border: 1px solid rgba(180, 122, 22, .24);
      border-radius: 16px;
      background: linear-gradient(120deg, #fff9e9, #fffdf7);
      color: #684211;
      box-shadow: 0 8px 22px rgba(80, 60, 24, .07);
    }
    .billing-notice > .material-icons { color: #c77913; }
    .billing-notice div { display: flex; flex-direction: column; min-width: 0; }
    .billing-notice strong { font-size: 13px; }
    .billing-notice div span { color: #85652f; font-size: 12px; }
    .billing-notice a {
      display: inline-flex; align-items: center; gap: 5px; color: #0f665d;
      font-size: 12px; font-weight: 800; text-decoration: none; white-space: nowrap;
    }
    .billing-notice a .material-icons { font-size: 16px; }
    .billing-notice.grace { background: linear-gradient(120deg, #fff1e6, #fffaf5); border-color: rgba(202, 92, 25, .28); }
    .billing-notice.urgent { background: linear-gradient(120deg, #fff0ee, #fff8f7); border-color: rgba(185, 48, 38, .28); color: #8f2922; }
    @media (max-width: 720px) {
      .billing-notice { grid-template-columns: auto 1fr; }
      .billing-notice a { grid-column: 2; }
    }
  `]
})
export class SubscriptionBannerComponent implements OnInit {
  summary: SubscriptionSummary | null = null;

  constructor(private billing: BillingDataService, private auth: AuthService) {}

  ngOnInit(): void {
    if (!this.auth.canView('billing')) return;
    this.billing.getOverview().subscribe({
      next: overview => this.summary = overview.summary,
      error: () => { /* The full subscription page surfaces load errors. */ }
    });
  }

  get visible(): boolean {
    if (!this.summary) return false;
    return ['grace', 'blocked', 'suspended', 'cancelled'].includes(this.summary.accessState)
      || this.summary.daysRemaining <= 7;
  }

  get icon(): string {
    return this.summary?.accessState === 'blocked' ? 'lock_clock' : 'event_upcoming';
  }

  get title(): string {
    if (this.summary?.accessState === 'grace') return 'Your shop is in the grace period';
    if (['blocked', 'suspended', 'cancelled'].includes(this.summary?.accessState || '')) return 'Sales creation is currently paused';
    return `${this.summary?.daysRemaining || 0} day${this.summary?.daysRemaining === 1 ? '' : 's'} left on this access period`;
  }

  get message(): string {
    if (this.summary?.accessState === 'grace') return `Renew before ${this.formatDate(this.summary.graceEndsAt)} to avoid read-only access.`;
    if (this.summary?.accessState === 'blocked') return 'Renew for GHS 100 to create new orders and stock sales.';
    if (this.summary?.accessState === 'suspended') return 'Contact BatchCommerce Support to review the suspension.';
    if (this.summary?.accessState === 'cancelled') return 'Reactivate billing to continue using sales workflows.';
    return `Current access ends ${this.formatDate(this.summary?.accessEndsAt || null)}.`;
  }

  private formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleDateString() : 'the end of the current period';
  }
}
