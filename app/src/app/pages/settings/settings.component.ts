import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { ShopConfigService } from '../../services/shop-config.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { ExcelService } from '../../services/excel.service';
import { ModalShellComponent } from '../../components/modal-shell/modal-shell.component';
import { PricingUsage } from '../../models';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent, RouterLink],
  template: `
    <div class="settings-page">
      <section class="settings-hero">
        <div class="hero-icon">
          <span class="material-icons">tune</span>
        </div>
        <div class="hero-copy">
          <span class="eyebrow">Workspace controls</span>
          <h1>Settings</h1>
          <p>Keep your shop profile, theme, data exports, and account security tidy from one place.</p>
        </div>
        <div class="hero-account">
          <span class="hero-account-label">Signed in as</span>
          <strong>{{ currentUserDisplayName }}</strong>
          <span>{{ currentUserRole }} at {{ shopConfig.shopName }}</span>
        </div>
      </section>

      <div class="set-status" *ngIf="statusMessage"
           [class.set-status-success]="statusTone === 'success'"
           [class.set-status-info]="statusTone === 'info'"
           [class.set-status-error]="statusTone === 'error'">
        <span class="material-icons">{{ statusTone === 'error' ? 'error_outline' : statusTone === 'info' ? 'info' : 'check_circle' }}</span>
        <span>{{ statusMessage }}</span>
        <button class="set-status-close" (click)="clearStatus()"><span class="material-icons">close</span></button>
      </div>

      <section class="settings-card subscription-card">
        <div class="card-heading">
          <div>
            <span class="eyebrow">Subscription</span>
            <h2>Plan snapshot</h2>
            <p>Monthly sales records count preorder orders and stock sales.</p>
          </div>
          <a class="ghost-link" routerLink="/subscription">
            View details
            <span class="material-icons">arrow_forward</span>
          </a>
        </div>

        <div class="billing-loading" *ngIf="loadingPricing">
          <span class="spinner"></span>
          Loading subscription details...
        </div>

        <div class="billing-error" *ngIf="pricingError">
          <span class="material-icons">error_outline</span>
          {{ pricingError }}
        </div>

        <div class="subscription-grid" *ngIf="!loadingPricing && pricingUsage">
          <div class="plan-tile">
            <span class="billing-badge" [class.billing-badge-promo]="pricingUsage.promoActive">
              {{ pricingStatusLabel }}
            </span>
            <div class="plan-name">BatchCommerce</div>
            <div class="plan-price">GHS {{ pricingUsage.priceGhs }}<span>/month</span></div>
            <p *ngIf="pricingUsage.promoActive">Promo ends {{ pricingUsage.promoEndsAt | date:'mediumDate' }}.</p>
            <p *ngIf="!pricingUsage.promoActive && pricingUsage.status !== 'active'">Activate your subscription to keep creating sales records.</p>
          </div>

          <div class="usage-tile">
            <div class="usage-count">
              <strong>{{ pricingUsage.usageCount }}</strong>
              <span>/ Unlimited</span>
            </div>
            <p>{{ pricingUsageSummary }}</p>
          </div>
        </div>
      </section>

      <div class="settings-layout">
        <main class="settings-main">
          <section class="settings-card">
            <div class="card-heading">
              <div>
                <span class="eyebrow">Business</span>
                <h2>Shop profile</h2>
                <p>This information is used across receipts, exports, and shared shop context.</p>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group form-group-wide">
                <label>Business Name</label>
                <input type="text" [(ngModel)]="settings.businessName" placeholder="Ama's Boutique" />
              </div>
              <div class="form-group">
                <label>Phone Number</label>
                <input type="tel" [(ngModel)]="settings.phone" placeholder="Your business phone" />
              </div>
              <div class="form-group">
                <label>WhatsApp Number</label>
                <input type="tel" [(ngModel)]="settings.whatsapp" placeholder="WhatsApp for orders" />
              </div>
              <div class="form-group form-group-wide">
                <label>Location/Address</label>
                <textarea [(ngModel)]="settings.address" placeholder="Business address..."></textarea>
              </div>
            </div>
          </section>

          <section class="settings-card">
            <div class="card-heading">
              <div>
                <span class="eyebrow">Appearance</span>
                <h2>Brand color</h2>
                <p>Pick the color that anchors buttons, highlights, and active navigation.</p>
              </div>
            </div>

            <div class="appearance-row">
              <div class="appearance-left">
                <label class="ap-label">Primary Color</label>
                <div class="ap-picker-row">
                  <div class="ap-swatch" [style.background]="primaryColor"></div>
                  <input type="color" class="ap-color-input" [(ngModel)]="primaryColor"
                         (ngModelChange)="applyColor($event)" />
                  <span class="ap-hex-label">{{ primaryColor }}</span>
                </div>

                <label class="ap-label ap-label-spaced">Presets</label>
                <div class="ap-presets">
                  <button *ngFor="let p of colorPresets"
                          class="ap-preset"
                          [style.background]="p.color"
                          [class.ap-preset-active]="primaryColor.toLowerCase() === p.color.toLowerCase()"
                          (click)="applyColor(p.color)"
                          [title]="p.name">
                  </button>
                </div>
              </div>

              <div class="ap-preview-panel" [style.--preview-color]="primaryColor">
                <div class="ap-preview-label">Live Preview</div>
                <button class="ap-preview-btn">
                  <span class="material-icons">check_circle</span>
                  Primary Button
                </button>
                <div class="ap-preview-nav">
                  <span class="material-icons">dashboard</span>
                  <span>Active Nav Item</span>
                </div>
                <div class="ap-preview-badge">Tag / Badge</div>
              </div>
            </div>
          </section>

          <section class="settings-card">
            <div class="card-heading compact-heading">
              <div>
                <span class="eyebrow">Preferences</span>
                <h2>App behavior</h2>
              </div>
            </div>

            <div class="form-group">
              <label>Currency Symbol</label>
              <select [(ngModel)]="settings.currency">
                <option value="GHS">GHS (Ghana Cedi)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="GBP">GBP (British Pound)</option>
              </select>
            </div>

            <div class="toggle-stack">
              <label class="toggle-card">
                <input type="checkbox" [(ngModel)]="settings.enableOrderAlerts" />
                <span>
                  <strong>Order notifications</strong>
                  <small>Get prompted when order events need attention.</small>
                </span>
              </label>
              <label class="toggle-card">
                <input type="checkbox" [(ngModel)]="settings.compactTables" />
                <span>
                  <strong>Compact tables</strong>
                  <small>Use tighter spacing where table density matters.</small>
                </span>
              </label>
            </div>
          </section>
        </main>

        <aside class="settings-side">
          <section class="settings-card account-card">
            <div class="card-heading compact-heading">
              <div>
                <span class="eyebrow">Account</span>
                <h2>Session</h2>
              </div>
            </div>
            <div class="about-info">
              <div class="info-row">
                <span>Name</span>
                <strong>{{ currentUserDisplayName }}</strong>
              </div>
              <div class="info-row">
                <span>Role</span>
                <strong>{{ currentUserRole }}</strong>
              </div>
              <div class="info-row">
                <span>Shop</span>
                <strong>{{ shopConfig.shopName }}</strong>
              </div>
            </div>
            <button class="btn btn-secondary full-btn" (click)="logoutAndGoLogin()">
              <span class="material-icons">logout</span>
              Sign Out
            </button>
          </section>

          <section class="settings-card">
            <div class="card-heading compact-heading">
              <div>
                <span class="eyebrow">Security</span>
                <h2>Password</h2>
              </div>
            </div>
            <div class="form-group">
              <label>Current Password</label>
              <input type="password" [(ngModel)]="currentPassword" autocomplete="current-password" />
            </div>
            <div class="form-group">
              <label>New Password</label>
              <input type="password" [(ngModel)]="newPassword" autocomplete="new-password" />
            </div>
            <div class="form-group">
              <label>Confirm New Password</label>
              <input type="password" [(ngModel)]="confirmNewPassword" autocomplete="new-password" />
            </div>
            <button class="btn btn-primary full-btn" (click)="changePassword()" [disabled]="changingPassword">
              <span *ngIf="changingPassword" class="spinner"></span>
              {{ changingPassword ? 'Updating...' : 'Change Password' }}
            </button>
          </section>

          <section class="settings-card data-card">
            <div class="card-heading compact-heading">
              <div>
                <span class="eyebrow">Data</span>
                <h2>Export & cleanup</h2>
              </div>
            </div>
            <div class="data-actions">
              <div class="action-item">
                <span class="action-icon">
                  <span class="material-icons">download</span>
                </span>
                <div class="action-info">
                  <strong>Export All Data</strong>
                  <p>Download your operational data as an Excel file.</p>
                </div>
                <button class="btn btn-secondary" (click)="exportData()" [disabled]="exporting">
                  <span *ngIf="exporting" class="spinner"></span>
                  {{ exporting ? 'Exporting...' : 'Export' }}
                </button>
              </div>
              <div class="action-item danger">
                <span class="action-icon danger-icon">
                  <span class="material-icons">delete_forever</span>
                </span>
                <div class="action-info">
                  <strong>Clear All Data</strong>
                  <p>Remove operational records. Users and roles stay intact.</p>
                </div>
                <button class="btn btn-danger" (click)="showClearModal = true" [disabled]="clearing">
                  {{ clearing ? 'Clearing...' : 'Clear' }}
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <div class="settings-save-bar">
        <span>Business profile and preferences are saved together.</span>
        <button class="btn btn-primary btn-lg save-btn" (click)="saveSettings()" [disabled]="savingSettings">
          <span *ngIf="savingSettings" class="spinner"></span>
          <span *ngIf="!savingSettings" class="material-icons">save</span>
          {{ savingSettings ? 'Saving...' : 'Save Settings' }}
        </button>
      </div>

      <!-- Clear Data Confirmation Modal -->
      <app-modal-shell
        *ngIf="showClearModal"
        size="sm"
        tone="danger"
        title="Clear All Data"
        subtitle="This permanently removes operational records"
        icon="warning"
        (closeRequested)="closeClearDataModal()">
        <div modal-body>
          <div class="danger-banner">
            <span class="material-icons">warning</span>
            <div>
              <strong>This action is permanent and cannot be undone!</strong>
              <p>The following data will be deleted:</p>
              <ul>
                <li>All products</li>
                <li>All clients</li>
                <li>All orders &amp; order items</li>
                <li>All batches</li>
                <li>All deliveries</li>
                <li>All buying list items</li>
                <li>All expenses</li>
              </ul>
              <p><strong>Users and roles will NOT be affected.</strong></p>
            </div>
          </div>
          <div class="form-group" style="margin-top:16px">
            <label>Type <strong>DELETE ALL</strong> to confirm:</label>
            <input type="text" [(ngModel)]="confirmPhrase" placeholder="Type DELETE ALL" autocomplete="off" />
          </div>
        </div>
        <div modal-footer>
          <button class="btn btn-secondary" (click)="closeClearDataModal()">Cancel</button>
          <button class="btn btn-danger" [disabled]="confirmPhrase !== 'DELETE ALL'" (click)="clearData()">
            <span class="material-icons">delete_forever</span>
            Permanently Delete All Data
          </button>
        </div>
      </app-modal-shell>
    </div>
  `,
  styles: [`
    .settings-page {
      --set-ink: #152033;
      --set-muted: #64748b;
      --set-line: #dbe4ef;
      --set-soft: #f8fafc;
      --set-paper: #ffffff;
      --set-warm: #fff7ed;
      --set-green: #ecfdf5;
      max-width: 1240px;
      margin: 0 auto;
      padding-bottom: 28px;
      color: var(--set-ink);
    }

    .settings-hero {
      position: relative;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) minmax(220px, 320px);
      gap: 18px;
      align-items: center;
      margin-bottom: 18px;
      padding: 24px;
      border: 1px solid rgba(99, 102, 241, 0.16);
      border-radius: 28px;
      overflow: hidden;
      background:
        radial-gradient(circle at 12% 0%, rgba(99, 102, 241, 0.16), transparent 28%),
        linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #fff7ed 100%);
    }

    .settings-hero::after {
      content: '';
      position: absolute;
      inset: auto 26px 0 auto;
      width: 190px;
      height: 80px;
      border-radius: 999px 999px 0 0;
      background: rgba(99, 102, 241, 0.08);
      transform: translateY(42%);
      pointer-events: none;
    }

    .hero-icon {
      width: 58px;
      height: 58px;
      border-radius: 20px;
      display: grid;
      place-items: center;
      background: var(--primary-color, #6366f1);
      color: #fff;
      z-index: 1;
    }

    .hero-icon .material-icons {
      font-size: 30px;
    }

    .hero-copy,
    .hero-account {
      position: relative;
      z-index: 1;
    }

    .hero-copy h1 {
      margin: 4px 0 6px;
      font-size: clamp(30px, 4vw, 48px);
      line-height: 0.95;
      letter-spacing: -0.05em;
      color: #111827;
    }

    .hero-copy p,
    .card-heading p {
      margin: 0;
      color: var(--set-muted);
      font-size: 14px;
      line-height: 1.55;
    }

    .hero-account {
      justify-self: end;
      width: 100%;
      padding: 15px;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.76);
      backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .hero-account-label,
    .eyebrow {
      color: var(--primary-color, #6366f1);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .hero-account strong {
      color: #0f172a;
      font-size: 15px;
      line-height: 1.2;
    }

    .hero-account span:last-child {
      color: var(--set-muted);
      font-size: 12px;
    }

    .set-status {
      margin: 0 0 16px;
      padding: 12px 14px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 500;
      border: 1px solid transparent;
    }
    .set-status .material-icons { font-size: 18px; }
    .set-status-success { background: #ecfdf5; color: #166534; border-color: #bbf7d0; }
    .set-status-info { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
    .set-status-error { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
    .set-status-close {
      margin-left: auto;
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: inherit;
      background: transparent;
      padding: 0;
    }
    .set-status-close .material-icons { font-size: 16px; }

    .settings-card {
      padding: 20px;
      border: 1px solid var(--set-line);
      border-radius: 24px;
      background: var(--set-paper);
    }

    .card-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }

    .compact-heading {
      margin-bottom: 14px;
    }

    .card-heading h2 {
      margin: 3px 0 4px;
      color: #0f172a;
      font-size: 20px;
      line-height: 1.1;
      letter-spacing: -0.03em;
    }

    .ghost-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 12px;
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 999px;
      color: var(--primary-color, #6366f1);
      background: rgba(99, 102, 241, 0.06);
      font-size: 12px;
      font-weight: 800;
      text-decoration: none;
      white-space: nowrap;
      transition: transform 0.16s ease, background 0.16s ease;
    }

    .ghost-link:hover {
      transform: translateY(-1px);
      background: rgba(99, 102, 241, 0.1);
    }

    .ghost-link .material-icons {
      font-size: 16px;
    }

    .subscription-card {
      margin-bottom: 18px;
      background:
        linear-gradient(120deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.96)),
        radial-gradient(circle at 95% 0%, rgba(245, 158, 11, 0.12), transparent 34%);
    }

    .subscription-grid {
      display: grid;
      grid-template-columns: minmax(220px, 0.72fr) minmax(0, 1.28fr);
      gap: 14px;
    }

    .plan-tile,
    .usage-tile {
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 20px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.75);
    }

    .plan-name {
      margin-top: 14px;
      color: #0f172a;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.04em;
      line-height: 1;
    }

    .plan-price {
      margin-top: 8px;
      color: var(--primary-color, #6366f1);
      font-size: 21px;
      font-weight: 900;
    }

    .plan-price span {
      margin-left: 3px;
      color: var(--set-muted);
      font-size: 12px;
      font-weight: 700;
    }

    .plan-tile p,
    .usage-tile p,
    .usage-tile small {
      display: block;
      margin: 10px 0 0;
      color: var(--set-muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .billing-badge {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      background: #eef2ff;
      color: #3730a3;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }

    .billing-badge-promo {
      background: #ecfdf5;
      color: #166534;
    }

    .billing-loading,
    .billing-error {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--set-muted);
      font-size: 13px;
    }

    .billing-error {
      margin-top: 12px;
      color: #991b1b;
    }

    .billing-error .material-icons {
      font-size: 18px;
    }

    .usage-count {
      display: flex;
      align-items: baseline;
      gap: 6px;
      color: var(--set-muted);
    }

    .usage-count strong {
      color: #0f172a;
      font-size: 34px;
      letter-spacing: -0.05em;
      line-height: 1;
    }

    .settings-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
      gap: 18px;
      align-items: start;
    }

    .settings-main,
    .settings-side {
      display: grid;
      gap: 18px;
    }

    .settings-side {
      position: sticky;
      top: 18px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 7px;
      margin: 0 0 14px;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    .form-group-wide {
      grid-column: 1 / -1;
    }

    .form-group label,
    .ap-label {
      color: #475569;
      font-size: 12px;
      font-weight: 850;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      border: 1px solid #dbe4ef;
      border-radius: 14px;
      background: #f8fafc;
      color: #0f172a;
      font-size: 14px;
      outline: none;
      transition: border-color 0.16s ease, background 0.16s ease;
    }

    .form-group input,
    .form-group select {
      min-height: 44px;
      padding: 0 13px;
    }

    .form-group textarea {
      min-height: 92px;
      resize: vertical;
      padding: 12px 13px;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      border-color: rgba(99, 102, 241, 0.65);
      background: #ffffff;
    }

    .appearance-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(190px, 230px);
      gap: 18px;
      align-items: stretch;
    }

    .appearance-left {
      min-width: 0;
    }

    .ap-label {
      display: block;
      margin-bottom: 8px;
    }

    .ap-label-spaced {
      margin-top: 16px;
    }

    .ap-picker-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      background: #f8fafc;
    }

    .ap-swatch {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      flex-shrink: 0;
    }

    .ap-color-input {
      width: 44px;
      height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 3px;
      cursor: pointer;
      background: #fff;
      flex-shrink: 0;
    }

    .ap-hex-label {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }

    .ap-presets {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .ap-preset {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.9);
      cursor: pointer;
      transition: transform 0.12s;
    }

    .ap-preset:hover { transform: scale(1.15); }
    .ap-preset-active {
      transform: scale(1.08);
    }

    .ap-preview-panel {
      min-width: 0;
      border: 1px solid #dbe4ef;
      border-radius: 20px;
      padding: 16px;
      background:
        radial-gradient(circle at 20% 0%, color-mix(in srgb, var(--preview-color, #6366f1) 20%, transparent), transparent 30%),
        #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .ap-preview-label {
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
      margin-bottom: 2px;
    }

    .ap-preview-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 14px;
      border: none;
      border-radius: 12px;
      background: var(--preview-color, #6366f1);
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      cursor: default;
      width: 100%;
      justify-content: center;
    }

    .ap-preview-btn .material-icons {
      font-size: 16px;
    }

    .ap-preview-nav {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 10px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--preview-color, #6366f1) 13%, white);
      color: var(--preview-color, #6366f1);
      font-size: 13px;
      font-weight: 800;
    }

    .ap-preview-nav .material-icons {
      font-size: 18px;
    }

    .ap-preview-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      align-self: flex-start;
      padding: 5px 12px;
      border-radius: 20px;
      background: #fff;
      color: var(--preview-color, #6366f1);
      border: 1px solid color-mix(in srgb, var(--preview-color, #6366f1) 35%, white);
      font-size: 12px;
      font-weight: 800;
    }

    .toggle-stack {
      display: grid;
      gap: 10px;
    }

    .toggle-card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 12px;
      align-items: start;
      padding: 14px;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      background: #f8fafc;
      cursor: pointer;
    }

    .toggle-card input[type='checkbox'] {
      width: 18px;
      height: 18px;
      margin-top: 2px;
      accent-color: var(--primary-color, #6366f1);
    }

    .toggle-card strong {
      display: block;
      color: #0f172a;
      font-size: 14px;
      margin-bottom: 2px;
    }

    .toggle-card small {
      color: var(--set-muted);
      font-size: 12px;
      line-height: 1.35;
    }

    .about-info {
      display: grid;
      gap: 8px;
      margin-bottom: 14px;
    }

    .info-row {
      display: grid;
      gap: 4px;
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #f8fafc;
    }

    .info-row span {
      color: var(--set-muted);
      font-size: 11px;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .info-row strong {
      min-width: 0;
      color: #0f172a;
      font-size: 13px;
      overflow-wrap: anywhere;
    }

    .full-btn {
      width: 100%;
      justify-content: center;
    }

    .data-actions {
      display: grid;
      gap: 12px;
    }

    .action-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 13px;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      background: #f8fafc;
    }

    .action-item.danger {
      border-color: #fecaca;
      background: #fff7f7;
    }

    .action-icon {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: #eef2ff;
      color: var(--primary-color, #6366f1);
    }

    .danger-icon {
      background: #fee2e2;
      color: #dc2626;
    }

    .action-icon .material-icons {
      font-size: 19px;
    }

    .action-info strong {
      display: block;
      color: #0f172a;
      font-size: 13px;
      margin-bottom: 3px;
    }

    .action-info p {
      color: var(--set-muted);
      font-size: 12px;
      line-height: 1.35;
      margin: 0;
    }

    .settings-save-bar {
      position: sticky;
      bottom: 16px;
      z-index: 5;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      margin-top: 18px;
      padding: 13px 14px 13px 18px;
      border: 1px solid rgba(99, 102, 241, 0.16);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(14px);
    }

    .settings-save-bar span {
      color: var(--set-muted);
      font-size: 13px;
      font-weight: 700;
    }

    .save-btn {
      min-width: 170px;
      justify-content: center;
    }

    .danger-banner {
      display: flex;
      gap: 12px;
      padding: 16px;
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: var(--radius-md);
      color: #991b1b;

      .material-icons {
        font-size: 28px;
        flex-shrink: 0;
      }

      p { margin: 6px 0 0; font-size: 13px; }
      ul { margin: 6px 0 0; padding-left: 18px; font-size: 13px; }
      li { margin-bottom: 2px; }
    }

    @media (max-width: 1100px) {
      .settings-hero {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .hero-account {
        grid-column: 1 / -1;
        justify-self: stretch;
      }

      .settings-layout {
        grid-template-columns: 1fr;
      }

      .settings-side {
        position: static;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .data-card {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 760px) {
      .settings-page {
        padding-bottom: 18px;
      }

      .settings-hero,
      .subscription-grid,
      .form-grid,
      .appearance-row,
      .settings-side {
        grid-template-columns: 1fr;
      }

      .settings-hero {
        padding: 20px;
        border-radius: 24px;
      }

      .hero-icon {
        width: 52px;
        height: 52px;
      }

      .card-heading,
      .settings-save-bar {
        flex-direction: column;
        align-items: stretch;
      }

      .ghost-link,
      .billing-badge {
        justify-content: center;
      }

      .settings-card {
        padding: 17px;
        border-radius: 22px;
      }

      .action-item {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .action-item button {
        grid-column: 1 / -1;
      }

      .settings-save-bar {
        bottom: 10px;
      }

      .save-btn {
        width: 100%;
      }
    }

    @media (max-width: 420px) {
      .settings-hero {
        gap: 12px;
      }

      .hero-copy h1 {
        font-size: 34px;
      }

      .settings-save-bar span {
        display: none;
      }
    }
  `]
})
export class SettingsComponent {
  settings = {
    businessName: 'Batch Commerce',
    phone: '',
    whatsapp: '',
    address: '',
    currency: 'GHS',
    enableOrderAlerts: true,
    compactTables: false
  };

  showClearModal = false;
  confirmPhrase = '';
  clearing = false;
  exporting = false;
  savingSettings = false;
  statusMessage = '';
  statusTone: 'success' | 'info' | 'error' = 'success';
  pricingUsage: PricingUsage | null = null;
  loadingPricing = false;
  pricingError = '';

  get pricingStatusLabel(): string {
    if (!this.pricingUsage) return 'Loading';
    if (this.pricingUsage.promoActive) return 'Promo';
    return this.pricingUsage.status.replace('_', ' ');
  }

  get pricingUsageSummary(): string {
    if (!this.pricingUsage) return '';
    return 'Unlimited sales records. Your price stays GHS 70 per month.';
  }

  get currentUserDisplayName(): string {
    return this.authService.currentUser?.fullName || this.authService.currentUser?.username || 'Unknown User';
  }
  get currentUserRole(): string {
    return this.authService.currentUser?.roleName || 'Member';
  }

  // Change password state
  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';
  changingPassword = false;

  // Appearance
  primaryColor: string;
  colorPresets = [
    { name: 'Indigo',    color: '#6366f1' },
    { name: 'Blue',      color: '#2563eb' },
    { name: 'Sky',       color: '#0ea5e9' },
    { name: 'Teal',      color: '#14b8a6' },
    { name: 'Green',     color: '#22c55e' },
    { name: 'Lime',      color: '#84cc16' },
    { name: 'Amber',     color: '#f59e0b' },
    { name: 'Orange',    color: '#f97316' },
    { name: 'Red',       color: '#ef4444' },
    { name: 'Rose',      color: '#f43f5e' },
    { name: 'Pink',      color: '#ec4899' },
    { name: 'Purple',    color: '#a855f7' },
    { name: 'Violet',    color: '#7c3aed' },
    { name: 'Slate',     color: '#475569' },
  ];

  constructor(
    private dbService: DatabaseService,
    public shopConfig: ShopConfigService,
    private router: Router,
    private authService: AuthService,
    private themeService: ThemeService,
    private excelService: ExcelService
  ) {
    this.loadSettings();
    this.loadPricingUsage();
    this.primaryColor = this.themeService.primaryColor;
  }

  private setStatus(message: string, tone: 'success' | 'info' | 'error' = 'success') {
    this.statusMessage = message;
    this.statusTone = tone;
  }

  clearStatus() {
    this.statusMessage = '';
  }

  loadPricingUsage() {
    this.loadingPricing = true;
    this.pricingError = '';
    this.dbService.getPricingUsage().subscribe({
      next: usage => {
        this.pricingUsage = usage;
        this.loadingPricing = false;
      },
      error: err => {
        this.pricingError = err?.message || 'Could not load subscription details.';
        this.loadingPricing = false;
      }
    });
  }

  closeClearDataModal() {
    this.showClearModal = false;
    this.confirmPhrase = '';
  }

  private normalizeShopSlug(value: string): string {
    const slug = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    return slug || 'shop';
  }

  applyColor(hex: string) {
    this.primaryColor = hex;
    this.themeService.savePrimaryColor(hex);
  }

  loadSettings() {
    this.settings.businessName = this.shopConfig.shopName || this.settings.businessName;
    const settingsKey = 'batchcommerce_settings';
    const saved = localStorage.getItem(settingsKey);
    if (saved) {
      this.settings = { ...this.settings, ...JSON.parse(saved) };
    }
    this.settings.businessName = (this.settings.businessName || this.shopConfig.shopName || '').trim() || this.shopConfig.shopName;
  }

  async saveSettings() {
    const businessName = String(this.settings.businessName || '').trim();
    if (!businessName) {
      this.setStatus('Business name is required.', 'error');
      return;
    }

    const sanitizedSettings = {
      ...this.settings,
      businessName,
      phone: String(this.settings.phone || '').trim(),
      whatsapp: String(this.settings.whatsapp || '').trim(),
      address: String(this.settings.address || '').trim(),
      currency: String(this.settings.currency || 'GHS').trim() || 'GHS'
    };

    this.savingSettings = true;
    this.clearStatus();

    try {
      localStorage.setItem('batchcommerce_settings', JSON.stringify(sanitizedSettings));
      this.settings = { ...sanitizedSettings };

      const existing = this.shopConfig.config;
      const desiredSlug = this.normalizeShopSlug(existing?.shopSlug || businessName);

      const result = await firstValueFrom(this.authService.updateActiveShopProfile(businessName, desiredSlug));
      this.settings.businessName = result.shopName;

      this.setStatus('Settings saved and synced successfully.', 'success');
    } catch (err: any) {
      const existing = this.shopConfig.config;
      const desiredSlug = this.normalizeShopSlug(existing?.shopSlug || businessName);

      this.shopConfig.saveConfig({
        shopId: existing?.shopId,
        shopName: businessName,
        shopSlug: desiredSlug
      });

      this.setStatus(
        `Settings saved locally, but shop sync failed: ${err?.message || 'unknown error'}`,
        'info'
      );
    } finally {
      this.savingSettings = false;
    }
  }

  async exportData() {
    if (this.exporting) return;

    this.exporting = true;
    this.clearStatus();
    try {
      const [products, clients, batches, orders, deliveries, buyingList, expenses] = await Promise.all([
        firstValueFrom(this.dbService.getProducts()),
        firstValueFrom(this.dbService.getClients()),
        firstValueFrom(this.dbService.getOrderBatches()),
        firstValueFrom(this.dbService.getOrders()),
        firstValueFrom(this.dbService.getDeliveries()),
        firstValueFrom(this.dbService.getBuyingList()),
        firstValueFrom(this.dbService.getExpenses())
      ]);

      const filenameDate = new Date().toISOString().slice(0, 10);
      const filename = `${this.normalizeShopSlug(this.shopConfig.shopName || 'shop')}-export-${filenameDate}.xlsx`;

      await this.excelService.exportWorkbook([
        { name: 'Products', data: products || [] },
        { name: 'Clients', data: clients || [] },
        { name: 'Batches', data: batches || [] },
        { name: 'Orders', data: orders || [] },
        { name: 'Deliveries', data: deliveries || [] },
        { name: 'Buying List', data: buyingList || [] },
        { name: 'Expenses', data: expenses || [] }
      ], filename);

      this.setStatus('Export completed successfully.', 'success');
    } catch (err: any) {
      this.setStatus(`Export failed: ${err?.message || 'unknown error'}`, 'error');
    } finally {
      this.exporting = false;
    }
  }

  logoutAndGoLogin() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  clearData() {
    this.clearing = true;
    this.showClearModal = false;

    this.dbService.clearAllData().subscribe(result => {
      this.clearing = false;
      this.confirmPhrase = '';

      if (result.success) {
        alert('All data has been cleared successfully. You can now start fresh.');
      } else {
        alert('Some tables could not be cleared:\n\n' + result.errors.join('\n'));
      }
    });
  }

  async changePassword() {
    if (!this.currentPassword || !this.newPassword) {
      alert('Please enter your current and new passwords');
      return;
    }
    if (this.newPassword !== this.confirmNewPassword) {
      alert('New password and confirmation do not match');
      return;
    }
    this.changingPassword = true;
    try {
      const result = await firstValueFrom(this.authService.changePassword(this.currentPassword, this.newPassword));
      this.changingPassword = false;
      if (result.success) {
        alert('Password changed successfully');
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmNewPassword = '';
      } else {
        alert('Failed to change password: ' + result.message);
      }
    } catch (err: any) {
      this.changingPassword = false;
      alert('Error changing password: ' + (err?.message || err));
    }
  }
}
