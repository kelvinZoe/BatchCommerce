import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { ShopConfigService } from '../../services/shop-config.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { ExcelService } from '../../services/excel.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page">
      <div class="page-header">
        <h1>Settings</h1>
        <p class="subtitle">Manage application settings and preferences</p>
      </div>

      <div class="set-status" *ngIf="statusMessage"
           [class.set-status-success]="statusTone === 'success'"
           [class.set-status-info]="statusTone === 'info'"
           [class.set-status-error]="statusTone === 'error'">
        <span class="material-icons">{{ statusTone === 'error' ? 'error_outline' : statusTone === 'info' ? 'info' : 'check_circle' }}</span>
        <span>{{ statusMessage }}</span>
        <button class="set-status-close" (click)="clearStatus()"><span class="material-icons">close</span></button>
      </div>

      <div class="settings-container">
        <div class="card">
          <div class="card-header">
            <h2>Business Information</h2>
          </div>
          <div class="form-group">
            <label>Business Name</label>
            <input type="text" [(ngModel)]="settings.businessName" placeholder="Shakhis Ventures" />
          </div>
          <div class="form-group">
            <label>Phone Number</label>
            <input type="tel" [(ngModel)]="settings.phone" placeholder="Your business phone" />
          </div>
          <div class="form-group">
            <label>WhatsApp Number</label>
            <input type="tel" [(ngModel)]="settings.whatsapp" placeholder="WhatsApp for orders" />
          </div>
          <div class="form-group">
            <label>Location/Address</label>
            <textarea [(ngModel)]="settings.address" placeholder="Business address..."></textarea>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Preferences</h2>
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
          <div class="form-group">
            <label class="toggle-row">
              <input type="checkbox" [(ngModel)]="settings.enableOrderAlerts" />
              <span>Enable order notifications</span>
            </label>
          </div>
          <div class="form-group">
            <label class="toggle-row">
              <input type="checkbox" [(ngModel)]="settings.compactTables" />
              <span>Use compact tables</span>
            </label>
          </div>
        </div>

        <!-- ── Appearance ── -->
        <div class="card">
          <div class="card-header">
            <h2>Appearance</h2>
            <p class="card-subtitle">Customize the primary color used throughout the app</p>
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

              <label class="ap-label" style="margin-top:14px">Presets</label>
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
                <span class="material-icons" style="font-size:16px">check_circle</span>
                Primary Button
              </button>
              <div class="ap-preview-nav">
                <span class="material-icons">dashboard</span>
                <span>Active Nav Item</span>
              </div>
              <div class="ap-preview-badge">Tag / Badge</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Data Management</h2>
          </div>
          <div class="data-actions">
            <div class="action-item">
              <div class="action-info">
                <strong>Export All Data</strong>
                <p>Download all your data as an Excel file</p>
              </div>
              <button class="btn btn-secondary" (click)="exportData()" [disabled]="exporting">
                <span *ngIf="exporting" class="spinner"></span>
                <span class="material-icons">download</span>
                {{ exporting ? 'Exporting...' : 'Export' }}
              </button>
            </div>
            <div class="action-item danger">
              <div class="action-info">
                <strong>Clear All Data</strong>
                <p>Remove all products, clients, batches, orders, deliveries, buying list &amp; expenses (cannot be undone)</p>
              </div>
              <button class="btn btn-danger" (click)="showClearModal = true" [disabled]="clearing">
                <span class="material-icons">delete_forever</span>
                {{ clearing ? 'Clearing...' : 'Clear All' }}
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Account</h2>
          </div>
          <div class="about-info">
            <div class="info-row">
              <span>Signed in as</span>
              <span>{{ currentUserDisplayName }}</span>
            </div>
            <div class="info-row">
              <span>Role</span>
              <span>{{ currentUserRole }}</span>
            </div>
            <div class="info-row">
              <span>Current Shop</span>
              <span>{{ shopConfig.shopName }}</span>
            </div>
          </div>
          <div class="form-actions" style="margin-top:16px">
            <button class="btn btn-secondary" (click)="logoutAndGoLogin()">
              <span class="material-icons">logout</span>
              Sign Out
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Security</h2>
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
          <div class="form-group">
            <button class="btn btn-primary" (click)="changePassword()" [disabled]="changingPassword">
              <span *ngIf="changingPassword" class="spinner"></span>
              {{ changingPassword ? 'Updating...' : 'Change Password' }}
            </button>
          </div>
        </div>

        <button class="btn btn-primary btn-lg save-btn" (click)="saveSettings()" [disabled]="savingSettings">
          <span *ngIf="savingSettings" class="spinner"></span>
          <span *ngIf="!savingSettings" class="material-icons">save</span>
          {{ savingSettings ? 'Saving...' : 'Save Settings' }}
        </button>
      </div>

      <!-- Clear Data Confirmation Modal -->
      <div class="modal-overlay" *ngIf="showClearModal" (click)="showClearModal = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>⚠️ Clear All Data</h3>
            <button class="close-btn" (click)="showClearModal = false">&times;</button>
          </div>
          <div class="modal-body">
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
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showClearModal = false; confirmPhrase = ''">Cancel</button>
            <button class="btn btn-danger" [disabled]="confirmPhrase !== 'DELETE ALL'" (click)="clearData()">
              <span class="material-icons">delete_forever</span>
              Permanently Delete All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-page {
      max-width: 800px;
    }

    .subtitle {
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .set-status {
      margin: 12px 0 18px;
      padding: 12px 14px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 500;
      border: 1px solid transparent;
    }
    .set-status .material-icons { font-size: 18px; }
    .set-status-success { background:#ecfdf5; color:#166534; border-color:#bbf7d0; }
    .set-status-info { background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; }
    .set-status-error { background:#fef2f2; color:#991b1b; border-color:#fecaca; }
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

    .settings-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .data-actions {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .action-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: var(--background-color);
      border-radius: var(--radius-md);

      &.danger {
        background: #fef2f2;
      }
    }

    .toggle-row {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 14px;
      color: #334155;
    }
    .toggle-row input[type='checkbox'] {
      width: 16px;
      height: 16px;
      accent-color: var(--primary-color, #6366f1);
    }

    .action-info {
      strong {
        display: block;
        margin-bottom: 4px;
      }

      p {
        color: var(--text-secondary);
        font-size: 13px;
        margin: 0;
      }
    }

    .about-info {
      display: flex;
      flex-direction: column;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid var(--border-color);

      &:last-child {
        border-bottom: none;
      }

      span:first-child {
        color: var(--text-secondary);
      }

      span:last-child {
        font-weight: 500;
      }
    }

    .save-btn {
      width: 100%;
    }

    .mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; }

    /* ── Card subtitle ── */
    .card-subtitle { color: var(--text-secondary); font-size: 13px; margin-top: 2px; }

    /* ── Appearance ─────────────────────────────────────── */
    .appearance-row { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
    .appearance-left { flex: 1; min-width: 200px; }

    .ap-label { display: block; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }

    .ap-picker-row { display: flex; align-items: center; gap: 10px; }
    .ap-swatch { width: 36px; height: 36px; border-radius: 8px; border: 1px solid #ccc; flex-shrink: 0; }
    .ap-color-input { width: 42px; height: 36px; border: 1px solid #ccc; border-radius: 8px; padding: 2px; cursor: pointer; background: #fff; flex-shrink: 0; }
    .ap-hex-label { font-size: 13px; font-weight: 600; color: #0f172a; font-family: 'SF Mono','Fira Code',monospace; }

    .ap-presets { display: flex; flex-wrap: wrap; gap: 8px; }
    .ap-preset { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: transform 0.12s, border-color 0.12s; }
    .ap-preset:hover { transform: scale(1.15); }
    .ap-preset-active { border-color: #0f172a !important; transform: scale(1.1); }

    /* ── Live preview panel ── */
    .ap-preview-panel {
      flex-shrink: 0;
      width: 190px;
      background: #f8fafc;
      border: 1px solid #ccc;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ap-preview-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 2px; }
    .ap-preview-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border: none; border-radius: 8px;
      background: var(--preview-color, #6366f1); color: #fff;
      font-size: 13px; font-weight: 600; cursor: default; width: 100%; justify-content: center;
    }
    .ap-preview-nav {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; border-radius: 8px;
      background: var(--preview-color, #6366f1); color: #fff;
      font-size: 13px; font-weight: 500;
      .material-icons { font-size: 18px; }
    }
    .ap-preview-badge {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 4px 12px; border-radius: 20px;
      background: var(--preview-color, #6366f1); color: #fff;
      font-size: 12px; font-weight: 600;
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

    /* ── Info box ── */
    .info-box {
      display: flex;
      gap: 12px;
      padding: 14px;
      background: #f0f9ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      color: #1e40af;
      margin-bottom: 16px;

      .material-icons {
        font-size: 20px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      strong { display: block; margin-bottom: 4px; }
      p { margin: 0; font-size: 13px; line-height: 1.5; }
      code { background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; }
    }

    /* ── Form actions ── */
    .form-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    /* ── Input large ── */
    .input-lg {
      padding: 10px 12px;
      font-size: 13px;
      width: 100%;
      box-sizing: border-box;
    }

    /* ── Status message ── */
    .status-message {
      display: flex;
      align-items: center;
      padding: 12px 14px;
      background: #d1fae5;
      border-radius: 8px;
      color: #065f46;
      font-size: 13px;
      font-weight: 500;

      .material-icons {
        font-size: 18px;
        margin-right: 6px;
      }
    }
  `]
})
export class SettingsComponent {
  settings = {
    businessName: 'Shakhis Ventures',
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
    this.primaryColor = this.themeService.primaryColor;
  }

  private setStatus(message: string, tone: 'success' | 'info' | 'error' = 'success') {
    this.statusMessage = message;
    this.statusTone = tone;
  }

  clearStatus() {
    this.statusMessage = '';
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
    const saved = localStorage.getItem('shakhis_settings');
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
      localStorage.setItem('shakhis_settings', JSON.stringify(sanitizedSettings));
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
