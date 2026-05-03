import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ShopConfigService } from '../../services/shop-config.service';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="setup-page">
      <div class="setup-card">
        <div class="setup-header">
          <span class="logo-icon">🛒</span>
          <h1>Get Started</h1>
          <p>Welcome aboard. Let’s create your account and set up your shop in a few quick steps.</p>
        </div>

        <div class="steps">
          <div class="step" [class.active]="step === 1" [class.done]="step > 1">
            <div class="step-num">{{ step > 1 ? '✓' : '1' }}</div>
            <span>Account</span>
          </div>
          <div class="step-line" [class.done]="step > 1"></div>
          <div class="step" [class.active]="step === 2" [class.done]="step > 2">
            <div class="step-num">{{ step > 2 ? '✓' : '2' }}</div>
            <span>Shop</span>
          </div>
          <div class="step-line" [class.done]="step > 2"></div>
          <div class="step" [class.active]="step === 3">
            <div class="step-num">✓</div>
            <span>Ready</span>
          </div>
        </div>

        <div class="step-content" *ngIf="step === 1">
          <div class="info-box" *ngIf="awaitingVerification">
            <span class="material-icons">mark_email_read</span>
            <div>
              <strong>Verify your email to continue</strong>
              <p>Your account is ready. Confirm your email, then sign in again to finish setting up your shop.</p>
            </div>
          </div>

          <div class="oauth-section">
            <button type="button" class="oauth-btn google-btn" (click)="signInWithOAuth('google')" [disabled]="loading">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
            <button type="button" class="oauth-btn github-btn" (click)="signInWithOAuth('github')" [disabled]="loading">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Continue with GitHub
            </button>
          </div>

          <div class="divider">
            <span>or</span>
          </div>

          <div class="form-group">
            <label>Full Name *</label>
            <input type="text" [(ngModel)]="fullName" placeholder="e.g., Shakhis Mensah" class="input-lg" />
          </div>

          <div class="form-group">
            <label>Email *</label>
            <input type="email" [(ngModel)]="email" placeholder="you@example.com" class="input-lg" />
            <div class="email-status" *ngIf="email && emailVerificationChecked">
              <span class="material-icons" [class.verified]="emailVerified" [class.unverified]="!emailVerified">
                {{ emailVerified ? 'check_circle' : 'error' }}
              </span>
              <small>{{ emailVerified ? 'Email verified' : 'Email not verified - check your inbox' }}</small>
            </div>
          </div>

          <div class="form-group">
            <label>Phone Number *</label>
            <input type="tel" [(ngModel)]="phone" placeholder="e.g., +233 24 000 0000" class="input-lg" />
          </div>

          <div class="form-group">
            <label>Password *</label>
            <input type="password" [(ngModel)]="password" placeholder="Create a strong password" class="input-lg" />
          </div>

          <div class="step-actions">
            <div></div>
            <button class="btn btn-primary" type="button" (click)="createAccount()" [disabled]="loading">
              <span class="material-icons spin" *ngIf="loading">sync</span>
              {{ loading ? 'Creating...' : 'Create Account' }}
              <span class="material-icons" *ngIf="!loading">arrow_forward</span>
            </button>
          </div>

          <div class="auth-cta">
            <small>Already registered?</small>
            <button type="button" class="text-link" (click)="goToLogin()">Sign in</button>
          </div>
        </div>

        <div class="step-content" *ngIf="step === 2">
          <div class="info-box">
            <span class="material-icons">storefront</span>
            <div>
              <strong>Welcome, let’s name your shop</strong>
              <p>Choose the name your customers and team will see in the app.</p>
            </div>
          </div>

          <div class="form-group">
            <label>Shop Name *</label>
            <input type="text" [(ngModel)]="shopName" placeholder="e.g., Shakhis Ventures" class="input-lg" />
          </div>

          <div class="step-actions">
            <button class="btn btn-secondary" type="button" (click)="step = 1">
              <span class="material-icons">arrow_back</span>
              Back
            </button>
            <button class="btn btn-primary" type="button" (click)="createShop()" [disabled]="loading">
              <span class="material-icons spin" *ngIf="loading">sync</span>
              {{ loading ? 'Creating...' : 'Create Shop' }}
              <span class="material-icons" *ngIf="!loading">arrow_forward</span>
            </button>
          </div>
        </div>

        <div class="step-content" *ngIf="step === 3">
          <div class="summary">
            <div class="summary-row success">
              <span class="material-icons">check_circle</span>
              <div>
                <strong>Account and shop created</strong>
                <p>{{ infoMessage || 'Your workspace is ready.' }}</p>
              </div>
            </div>
            <div class="summary-row">
              <span class="material-icons">person</span>
              <div>
                <strong>Signed In As</strong>
                <p>{{ fullName || email }}</p>
              </div>
            </div>
            <div class="summary-row">
              <span class="material-icons">storefront</span>
              <div>
                <strong>Shop</strong>
                <p>{{ shopConfig.shopName }}</p>
              </div>
            </div>
            <div class="summary-row">
              <span class="material-icons">dns</span>
              <div>
                <strong>Shop Code</strong>
                <p class="mono">Auto-generated</p>
              </div>
            </div>
          </div>

          <div class="step-actions">
            <div></div>
            <button class="btn btn-primary btn-lg" type="button" (click)="openDashboard()">
              <span class="material-icons">rocket_launch</span>
              Open Dashboard
            </button>
          </div>
        </div>

        <!-- Error message -->
        <div class="error-message" *ngIf="errorMessage">
          <span class="material-icons">error</span>
          {{ errorMessage }}
        </div>

        <div class="setup-footer">
          <small>Use this page to create your account and set up your shop.</small>
          <small>The shop code is generated automatically.</small>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .setup-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      padding: 20px;
    }

    .setup-card {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 100%;
      max-width: 560px;
      overflow: hidden;
    }

    .setup-header {
      text-align: center;
      padding: 40px 32px 16px;

      .logo-icon { font-size: 48px; display: block; margin-bottom: 12px; }
      h1 { font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
      p { color: #64748b; font-size: 14px; line-height: 1.5; max-width: 400px; margin: 0 auto; }
    }

    /* ── Steps indicator ── */
    .steps {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 32px 8px;
      gap: 0;
    }

    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;

      .step-num {
        width: 32px; height: 32px;
        border-radius: 50%;
        background: #e2e8f0;
        color: #64748b;
        display: flex; align-items: center; justify-content: center;
        font-weight: 600; font-size: 14px;
        transition: all 0.3s;
      }

      span { font-size: 12px; color: #94a3b8; font-weight: 500; }

      &.active .step-num { background: #2563eb; color: white; }
      &.active span { color: #2563eb; }
      &.done .step-num { background: #10b981; color: white; }
      &.done span { color: #10b981; }
    }

    .step-line {
      width: 60px; height: 2px;
      background: #e2e8f0;
      margin: 0 8px;
      margin-bottom: 22px;
      transition: background 0.3s;

      &.done { background: #10b981; }
    }

    /* ── Step content ── */
    .step-content {
      padding: 24px 32px;
    }

    .oauth-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }

    .oauth-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 12px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: white;
      color: #334155;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;

      &:hover:not(:disabled) {
        border-color: #cbd5e1;
        background: #f8fafc;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      svg {
        flex-shrink: 0;
      }
    }

    .google-btn {
      border-color: #dadce0;
      color: #3c4043;

      &:hover:not(:disabled) {
        border-color: #c4c7c5;
        background: #f8f9fa;
      }
    }

    .github-btn {
      border-color: #d1d5db;
      color: #374151;

      &:hover:not(:disabled) {
        border-color: #9ca3af;
        background: #f9fafb;
      }
    }

    .divider {
      display: flex;
      align-items: center;
      margin: 20px 0;
      text-align: center;

      &::before,
      &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #e2e8f0;
      }

      span {
        padding: 0 16px;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 500;
      }
    }

    .form-group {
      margin-bottom: 20px;

      label {
        display: block; margin-bottom: 6px;
        font-size: 14px; font-weight: 600; color: #334155;
      }
    }

    .form-hint {
      display: block; margin-top: 6px;
      font-size: 12px; color: #94a3b8;
    }

    .auth-cta {
      margin-top: 12px;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;

      small {
        color: #64748b;
        font-size: 12px;
      }
    }

    .text-link {
      border: none;
      background: transparent;
      padding: 0;
      color: #2563eb;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }

      &:focus-visible {
        outline: 2px solid rgba(37, 99, 235, 0.35);
        outline-offset: 2px;
        border-radius: 4px;
      }
    }

    .input-lg {
      width: 100%;
      padding: 12px 16px;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      font-size: 14px;
      background: #f8fafc;
      transition: all 0.2s;

      &:focus {
        outline: none;
        border-color: #2563eb;
        background: white;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
      }
    }

    .email-status {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;

      .material-icons {
        font-size: 16px;
        flex-shrink: 0;

        &.verified {
          color: #10b981;
        }

        &.unverified {
          color: #f59e0b;
        }
      }

      small {
        color: #64748b;
        font-size: 12px;
      }
    }

    textarea.input-lg {
      resize: vertical;
      min-height: 70px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 12px;
      line-height: 1.5;
    }

    .mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px; }

    .info-box {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: #eff6ff;
      border-radius: 10px;
      border: 1px solid #bfdbfe;
      margin-bottom: 20px;
      color: #1e40af;

      .material-icons { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
      strong { display: block; font-size: 13px; margin-bottom: 2px; }
      p { margin: 0; font-size: 12px; opacity: 0.8; }
      em { font-style: normal; font-weight: 600; }
    }

    .step-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
      padding-top: 16px;
      border-top: 1px solid #f1f5f9;

      .btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 20px;
        font-size: 14px;
        font-weight: 600;
        border-radius: 10px;
      }

      .btn-lg {
        padding: 14px 28px;
        font-size: 15px;
      }
    }

    /* ── Summary ── */
    .summary {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .summary-row {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 14px 16px;
      background: #f8fafc;
      border-radius: 10px;

      .material-icons { font-size: 22px; color: #64748b; margin-top: 2px; }
      strong { display: block; font-size: 13px; color: #334155; margin-bottom: 2px; }
      p { margin: 0; font-size: 13px; color: #64748b; word-break: break-all; }

      &.success {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        .material-icons { color: #16a34a; }
        strong { color: #166534; }
        p { color: #166534; }
      }
    }

    /* ── Error ── */
    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 32px 16px;
      padding: 12px 14px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 10px;
      color: #dc2626;
      font-size: 13px;

      .material-icons { font-size: 18px; flex-shrink: 0; }
    }

    .setup-footer {
      text-align: center;
      padding: 16px 32px 24px;
      border-top: 1px solid #f1f5f9;

      small { color: #94a3b8; font-size: 12px; }
    }

    @keyframes spin { to { transform: rotate(360deg); } }
    .spin { animation: spin 1s linear infinite; }
  `]
})
export class SetupComponent implements OnInit {
  step = 1;
  fullName = '';
  email = '';
  password = '';
  phone = '';
  shopName = '';
  loading = false;
  awaitingVerification = false;
  errorMessage = '';
  infoMessage = '';
  emailVerificationChecked = false;
  emailVerified = false;
  private readonly draftKey = 'shakhis_pending_workspace_setup';

  constructor(
    public shopConfig: ShopConfigService,
    private supaService: SupabaseService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.prefillFromAuth();

    const draft = this.loadDraft();
    if (draft) {
      this.fullName = this.fullName || draft.fullName;
      this.email = this.email || draft.email;
      this.phone = this.phone || draft.phone || '';
      this.shopName = this.shopName || draft.shopName || '';
      this.awaitingVerification = true;
      if (this.step < 2) {
        this.step = 1;
      }
    }
  }

  private async prefillFromAuth(): Promise<void> {
    try {
      const { data } = await this.supaService.client.auth.getUser();
      const authUser = data?.user;
      if (!authUser) {
        return;
      }

      this.fullName = this.fullName || authUser.user_metadata?.['full_name'] || authUser.user_metadata?.['name'] || '';
      this.email = this.email || authUser.email || '';
      this.phone = this.phone || authUser.user_metadata?.['phone'] || '';
      this.step = 2;
      this.awaitingVerification = false;
      this.infoMessage = 'Your account is signed in. Create your shop workspace below.';
    } catch {
      // Ignore auth lookup issues during first launch.
    }
  }

  private loadDraft(): { fullName: string; email: string; phone?: string; shopName?: string } | null {
    try {
      const raw = localStorage.getItem(this.draftKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private saveDraft(): void {
    localStorage.setItem(this.draftKey, JSON.stringify({
      fullName: this.fullName.trim(),
      email: this.email.trim().toLowerCase(),
      phone: this.phone.trim(),
      shopName: this.shopName.trim()
    }));
  }

  private clearDraft(): void {
    localStorage.removeItem(this.draftKey);
  }

  async createAccount() {
    this.errorMessage = '';
    this.infoMessage = '';

    if (!this.fullName.trim()) {
      this.errorMessage = 'Please enter your full name';
      return;
    }

    if (!this.email.trim()) {
      this.errorMessage = 'Please enter your email';
      return;
    }

    if (!this.authService.isValidEmail(this.email)) {
      this.errorMessage = 'Enter a valid email address like user@example.com';
      return;
    }

    if (!this.phone.trim()) {
      this.errorMessage = 'Please enter your phone number';
      return;
    }

    if (!this.password.trim()) {
      this.errorMessage = 'Please enter a password';
      return;
    }

    this.loading = true;

    try {
      const result = await firstValueFrom(this.authService.registerAccount(
        this.fullName,
        this.email,
        this.password,
        this.phone
      ));

      if (!result.success) {
        this.errorMessage = result.message;
        return;
      }

      if (result.sessionCreated) {
        this.awaitingVerification = false;
        this.step = 2;
        this.infoMessage = 'Account created. Now create your shop workspace.';
        this.clearDraft();
        return;
      }

      this.awaitingVerification = true;
      this.step = 1;
      this.infoMessage = result.message;
      this.saveDraft();
    } catch (err: any) {
      this.errorMessage = err.message || 'Could not create account';
    } finally {
      this.loading = false;
    }
  }

  async createShop() {
    this.errorMessage = '';
    this.infoMessage = '';

    if (!this.shopName.trim()) {
      this.errorMessage = 'Please enter a shop name';
      return;
    }

    this.loading = true;

    try {
      const result = await firstValueFrom(this.authService.bootstrapWorkspace({
        fullName: this.fullName.trim(),
        email: this.email.trim(),
        phone: this.phone.trim(),
        shopName: this.shopName.trim()
      }));

      if (!result.success) {
        this.errorMessage = result.message;
        return;
      }

      this.clearDraft();
      this.infoMessage = result.message;
      this.step = 3;
    } catch (err: any) {
      this.errorMessage = err.message || 'Could not create shop';
    } finally {
      this.loading = false;
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  openDashboard() {
    this.router.navigate(['/dashboard']);
  }

  signInWithOAuth(provider: 'google' | 'github' | 'facebook') {
    this.loading = true;
    this.errorMessage = '';
    
    this.authService.signInWithOAuth(provider).subscribe(result => {
      this.loading = false;
      if (!result.success) {
        this.errorMessage = result.message;
      }
      // OAuth will redirect, so no further action needed on success
    });
  }

  async checkEmailVerification() {
    if (!this.authService.isValidEmail(this.email)) {
      this.emailVerificationChecked = false;
      return;
    }

    try {
      // Check if this email is already registered and verified
      const { data, error } = await this.supaService.client.auth.getUser();
      if (!error && data?.user?.email === this.email && data.user.email_confirmed_at) {
        this.emailVerified = true;
        this.emailVerificationChecked = true;
        return;
      }

      // Check app_users table for existing verified email
      const { data: userData, error: userError } = await this.supaService.client
        .from('app_users')
        .select('email')
        .eq('email', this.email.trim().toLowerCase())
        .maybeSingle();

      if (!userError && userData) {
        // Email exists in app_users, check if verified
        const { data: authData, error: authError } = await this.supaService.client.auth.getUser();
        this.emailVerified = !authError && !!authData?.user?.email_confirmed_at;
      } else {
        // Email not registered yet
        this.emailVerified = false;
      }

      this.emailVerificationChecked = true;
    } catch (err) {
      this.emailVerificationChecked = false;
    }
  }
}
