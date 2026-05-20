import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { ShopConfigService } from '../../services/shop-config.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
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
            <h2>Default Settings</h2>
          </div>
          <div class="form-group">
            <label>Default Delivery Fee (GHS)</label>
            <input type="number" [(ngModel)]="settings.defaultDeliveryFee" placeholder="0.00" />
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
              <button class="btn btn-secondary" (click)="exportData()">
                <span class="material-icons">download</span>
                Export
              </button>
            </div>
            <div class="action-item danger">
              <div class="action-info">
                <strong>Clear All Data</strong>
                <p>Remove all products, clients, orders, deliveries, buying list &amp; expenses (cannot be undone)</p>
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
            <h2>Worker Account Creation</h2>
          </div>
          <div class="status-message" style="margin-bottom:16px;padding:12px;background:#d1fae5;border-radius:8px;color:#065f46;font-size:13px">
            <span class="material-icons" style="vertical-align:middle;margin-right:6px">check_circle</span>
            ✓ Admin API can be enabled manually for privileged user management.
          </div>
          <div class="info-box">
            <span class="material-icons">info</span>
            <div>
              <strong>Optional Admin API Secret</strong>
              <p>Leave this blank unless you have a secure backend endpoint that expects the secret. It is stored only in session storage.</p>
            </div>
          </div>
          <div class="form-group">
            <label>Admin API Secret (Optional)</label>
            <input type="password" [(ngModel)]="adminApiSecret" placeholder="Enter only if you use the admin API"
                   class="input-lg mono" />
            <small class="form-hint">Override is stored in session storage and cleared when you close your browser.</small>
          </div>
          <div class="form-actions" style="margin-top:16px">
            <button class="btn btn-primary" (click)="saveAdminApiSecret()" [disabled]="saving">
              {{ saving ? 'Saving...' : 'Save Secret' }}
            </button>
            <button class="btn btn-secondary" (click)="clearAdminApiSecret()" *ngIf="adminApiSecret">
              <span class="material-icons">close</span>
              Clear Secret
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Shop Configuration</h2>
          </div>
          <div class="about-info">
            <div class="info-row">
              <span>Shop Name</span>
              <span>{{ shopConfig.shopName }}</span>
            </div>
            <div class="info-row">
              <span>Supabase URL</span>
              <span class="mono">{{ shopConfig.supabaseUrl }}</span>
            </div>
            <div class="info-row">
              <span>Configured</span>
              <span>{{ shopConfig.config?.configuredAt | date:'medium' }}</span>
            </div>
          </div>
          <div class="data-actions" style="margin-top:16px">
            <div class="action-item danger">
              <div class="action-info">
                <strong>Reset Shop Configuration</strong>
                <p>Clear all connection settings and return to the setup screen</p>
              </div>
              <button class="btn btn-danger" (click)="resetShopConfig()">
                <span class="material-icons">restart_alt</span>
                Reset
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>About</h2>
          </div>
          <div class="about-info">
            <div class="info-row">
              <span>Application</span>
              <span>{{ shopConfig.shopName }} Commerce</span>
            </div>
            <div class="info-row">
              <span>Version</span>
              <span>1.0.0</span>
            </div>
            <div class="info-row">
              <span>Database</span>
              <span>Supabase (PostgreSQL)</span>
            </div>
            <div class="info-row">
              <span>Framework</span>
              <span>Angular</span>
            </div>
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

        <button class="btn btn-primary btn-lg save-btn" (click)="saveSettings()">
          <span class="material-icons">save</span>
          Save Settings
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
                  <li>All order batches</li>
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
    defaultDeliveryFee: 0,
    currency: 'GHS'
  };

  showClearModal = false;
  confirmPhrase = '';
  clearing = false;
  
  // Admin API
  adminApiSecret = '';
  saving = false;
  get isAdminApiConfigured(): boolean {
    return !!sessionStorage.getItem('shakhis_admin_api_secret');
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
    private themeService: ThemeService
  ) {
    this.loadSettings();
    this.primaryColor = this.themeService.primaryColor;
  }

  applyColor(hex: string) {
    this.primaryColor = hex;
    this.themeService.savePrimaryColor(hex);
  }

  loadSettings() {
    const saved = localStorage.getItem('shakhis_settings');
    if (saved) {
      this.settings = { ...this.settings, ...JSON.parse(saved) };
    }
    // Load admin API secret from sessionStorage
    const secret = sessionStorage.getItem('shakhis_admin_api_secret');
    if (secret) {
      this.adminApiSecret = secret;
    }
  }

  saveSettings() {
    localStorage.setItem('shakhis_settings', JSON.stringify(this.settings));
    alert('Settings saved successfully!');
  }

  saveAdminApiSecret() {
    if (!this.adminApiSecret.trim()) {
      alert('Please enter an admin API secret');
      return;
    }

    this.saving = true;
    setTimeout(() => {
      // Store in sessionStorage - persists during session but clears on browser close
      sessionStorage.setItem('shakhis_admin_api_secret', this.adminApiSecret.trim());
      this.saving = false;
      alert('Admin API Secret saved! Worker accounts can now be created instantly.\n\n(Note: This will clear when you close your browser for security.)');
    }, 500);
  }

  clearAdminApiSecret() {
    if (confirm('Remove the saved Admin API Secret? You\'ll need to re-enter it next time.')) {
      sessionStorage.removeItem('shakhis_admin_api_secret');
      this.adminApiSecret = '';
      alert('Admin API Secret cleared.');
    }
  }

  resetShopConfig() {
    if (confirm('This will disconnect the app from the current shop database and return to the setup screen.\n\nAre you sure?')) {
      this.shopConfig.clearConfig();
      this.router.navigate(['/setup']);
    }
  }

  exportData() {
    alert('Export functionality will be implemented with the database service.');
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
