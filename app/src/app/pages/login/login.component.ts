import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ShopConfigService } from '../../services/shop-config.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Remix Icons CDN -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/remixicon@4.3.0/fonts/remixicon.css" />

    <div class="login-root">

      <!-- ── Left panel: branding ───────────────────── -->
      <div class="brand-panel">
        <div class="brand-bg-grid"></div>
        <div class="brand-glow brand-glow-1"></div>
        <div class="brand-glow brand-glow-2"></div>

        <div class="brand-content">
          <div class="brand-logo">
            <img src="assets/batchcommerce_icon.png" alt="BatchCommerce" style="width: 48px; height: 48px; object-fit: cover; border-radius: 12px; box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);" />
            <span class="brand-name">BatchCommerce</span>
          </div>

          <div class="brand-headline">
            <h2>Commerce, simplified.</h2>
            <p>Manage batches, orders, deliveries and your whole team from a single powerful dashboard.</p>
          </div>

          <div class="brand-features">
            <div class="feature-item">
              <div class="feature-icon"><i class="ri-store-2-line"></i></div>
              <span>Multi-shop workspace</span>
            </div>
            <div class="feature-item">
              <div class="feature-icon"><i class="ri-bar-chart-2-line"></i></div>
              <span>Real-time analytics</span>
            </div>
            <div class="feature-item">
              <div class="feature-icon"><i class="ri-team-line"></i></div>
              <span>Role-based access control</span>
            </div>
            <div class="feature-item">
              <div class="feature-icon"><i class="ri-shield-check-line"></i></div>
              <span>Secure &amp; encrypted data</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Right panel: form ───────────────────────── -->
      <div class="form-panel">
        <div class="form-container">

          <!-- Sign-in form -->
          <div class="form-card" *ngIf="!showForgotPassword">
            <div class="form-header">
              <p class="form-eyebrow">Welcome back</p>
              <h1 class="form-title">{{ shopTitle }}</h1>
              <p class="form-sub">Sign in to continue to your workspace</p>
            </div>

            <form (ngSubmit)="onLogin()" autocomplete="on" novalidate>

              <!-- Email field -->
              <div class="field" [class.field-focused]="emailFocused" [class.field-filled]="email">
                <label class="field-label">Email or Username</label>
                <div class="field-body">
                  <i class="ri-mail-line field-icon"></i>
                  <input
                    id="login-email"
                    type="text"
                    [(ngModel)]="email"
                    name="email"
                    autocomplete="username"
                    placeholder="you@example.com"
                    (focus)="emailFocused=true; errorMessage=''"
                    (blur)="emailFocused=false"
                    (keydown)="errorMessage=''"
                  />
                </div>
              </div>

              <!-- Password field -->
              <div class="field" [class.field-focused]="passwordFocused" [class.field-filled]="password">
                <label class="field-label">Password</label>
                <div class="field-body">
                  <i class="ri-lock-line field-icon"></i>
                  <input
                    id="login-password"
                    [type]="showPassword ? 'text' : 'password'"
                    [(ngModel)]="password"
                    name="password"
                    autocomplete="current-password"
                    placeholder="Enter your password"
                    (focus)="passwordFocused=true; errorMessage=''"
                    (blur)="passwordFocused=false"
                    (keydown)="errorMessage=''"
                  />
                  <button type="button" class="eye-btn" (click)="showPassword=!showPassword" tabindex="-1">
                    <i [class]="showPassword ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
                  </button>
                </div>
              </div>

              <!-- Forgot link -->
              <div class="row-between">
                <span></span>
                <button type="button" class="text-link" (click)="showForgotPassword=true">
                  Forgot password?
                </button>
              </div>

              <!-- Error -->
              <div class="alert alert-error" *ngIf="errorMessage">
                <i class="ri-error-warning-line"></i>
                <span>{{ errorMessage }}</span>
              </div>

              <!-- Submit -->
              <button
                type="submit"
                class="btn-primary-full"
                id="login-submit"
                [disabled]="loading">
                <span class="btn-spinner" *ngIf="loading">
                  <i class="ri-loader-4-line spinning"></i>
                </span>
                <span>{{ loading ? 'Signing in...' : 'Sign in' }}</span>
                <i class="ri-arrow-right-line btn-arrow" *ngIf="!loading"></i>
              </button>

            </form>

            <div class="form-footer">
              <span>Don't have an account?</span>
              <button type="button" class="text-link-bold" (click)="goToRegister()">
                Create a shop
                <i class="ri-external-link-line"></i>
              </button>
            </div>
          </div>

          <!-- Forgot password card -->
          <div class="form-card" *ngIf="showForgotPassword">
            <button type="button" class="back-btn" (click)="showForgotPassword=false; successMessage=''; resetError=''">
              <i class="ri-arrow-left-line"></i> Back to sign in
            </button>

            <div class="form-header">
              <div class="reset-icon-wrap">
                <i class="ri-mail-send-line"></i>
              </div>
              <h1 class="form-title">Reset password</h1>
              <p class="form-sub">We'll send a secure reset link to your email address.</p>
            </div>

            <div class="field" [class.field-focused]="resetFocused" [class.field-filled]="resetEmail">
              <label class="field-label">Email address</label>
              <div class="field-body">
                <i class="ri-mail-line field-icon"></i>
                <input
                  id="reset-email"
                  type="email"
                  [(ngModel)]="resetEmail"
                  name="resetEmail"
                  placeholder="you@example.com"
                  (focus)="resetFocused=true"
                  (blur)="resetFocused=false"
                />
              </div>
            </div>

            <div class="alert alert-success" *ngIf="successMessage">
              <i class="ri-checkbox-circle-line"></i>
              <span>{{ successMessage }}</span>
            </div>

            <div class="alert alert-error" *ngIf="resetError">
              <i class="ri-error-warning-line"></i>
              <span>{{ resetError }}</span>
            </div>

            <button
              type="button"
              class="btn-primary-full"
              id="reset-submit"
              (click)="sendReset()"
              [disabled]="loading">
              <span class="btn-spinner" *ngIf="loading">
                <i class="ri-loader-4-line spinning"></i>
              </span>
              <span>{{ loading ? 'Sending...' : 'Send reset link' }}</span>
              <i class="ri-send-plane-line btn-arrow" *ngIf="!loading"></i>
            </button>
          </div>

          <p class="copyright">BatchCommerce &copy; {{ year }}</p>
        </div>
      </div>

    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    :host {
      display: block;
      font-family: 'Inter', system-ui, sans-serif;
    }

    /* ── Root layout ──────────────────────────────────── */
    .login-root {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1fr 1fr;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    /* ── Brand panel ──────────────────────────────────── */
    .brand-panel {
      position: relative;
      background: #0a0f1e;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 60px 48px;
      overflow: hidden;

      @media (max-width: 900px) {
        display: none;
      }
    }

    .brand-bg-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(99,102,241,0.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(99,102,241,0.07) 1px, transparent 1px);
      background-size: 40px 40px;
    }

    .brand-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
    }

    .brand-glow-1 {
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%);
      top: -100px;
      left: -100px;
      animation: glowFloat 8s ease-in-out infinite;
    }

    .brand-glow-2 {
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(79,70,229,0.2) 0%, transparent 70%);
      bottom: -80px;
      right: -80px;
      animation: glowFloat 10s ease-in-out infinite reverse;
    }

    @keyframes glowFloat {
      0%, 100% { transform: translate(0, 0); }
      50% { transform: translate(20px, -30px); }
    }

    .brand-content {
      position: relative;
      z-index: 1;
      max-width: 420px;
      width: 100%;
    }

    .brand-logo {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 56px;

      svg { flex-shrink: 0; }
    }

    .brand-name {
      font-size: 20px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.3px;
    }

    .brand-headline {
      margin-bottom: 48px;

      h2 {
        font-size: 36px;
        font-weight: 700;
        color: #f8fafc;
        line-height: 1.2;
        letter-spacing: -0.5px;
        margin: 0 0 14px;
      }

      p {
        font-size: 15px;
        color: #94a3b8;
        line-height: 1.7;
        margin: 0;
      }
    }

    .brand-features {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 14px;
      animation: slideIn 0.5s ease both;

      &:nth-child(1) { animation-delay: 0.1s; }
      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.3s; }
      &:nth-child(4) { animation-delay: 0.4s; }

      span {
        font-size: 14px;
        font-weight: 500;
        color: #cbd5e1;
      }
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-16px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    .feature-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: rgba(99,102,241,0.15);
      border: 1px solid rgba(99,102,241,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;

      i {
        font-size: 17px;
        color: #a5b4fc;
      }
    }

    /* ── Form panel ───────────────────────────────────── */
    .form-panel {
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 32px;
    }

    .form-container {
      width: 100%;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      animation: fadeUp 0.45s ease both;
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Form card ────────────────────────────────────── */
    .form-card {
      background: #fff;
      border-radius: 20px;
      padding: 40px 36px;
      box-shadow:
        0 1px 3px rgba(0,0,0,0.06),
        0 8px 32px rgba(0,0,0,0.08);
      border: 1px solid #e2e8f0;

      @media (max-width: 480px) {
        padding: 28px 22px;
      }
    }

    .form-header {
      margin-bottom: 30px;
    }

    .form-eyebrow {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6366f1;
      margin: 0 0 8px;
    }

    .form-title {
      font-size: 26px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.4px;
      margin: 0 0 6px;
    }

    .form-sub {
      font-size: 14px;
      color: #64748b;
      margin: 0;
    }

    /* ── Fields ───────────────────────────────────────── */
    .field {
      margin-bottom: 20px;
    }

    .field-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px;
      transition: color 0.2s;
    }

    .field-focused .field-label {
      color: #6366f1;
    }

    .field-body {
      position: relative;
      display: flex;
      align-items: center;
    }

    .field-icon {
      position: absolute;
      left: 14px;
      font-size: 18px;
      color: #94a3b8;
      pointer-events: none;
      transition: color 0.2s;
    }

    .field-focused .field-icon {
      color: #6366f1;
    }

    .field-body input {
      width: 100%;
      padding: 12px 14px 12px 42px;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      font-size: 14px;
      font-family: inherit;
      color: #0f172a;
      background: #f8fafc;
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
      outline: none;
      box-sizing: border-box;

      &::placeholder { color: #cbd5e1; }

      &:focus {
        border-color: #6366f1;
        background: #fff;
        box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
      }
    }

    .eye-btn {
      position: absolute;
      right: 12px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      color: #94a3b8;
      transition: color 0.2s;

      i { font-size: 18px; }

      &:hover { color: #475569; }
    }

    /* ── Row ──────────────────────────────────────────── */
    .row-between {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: -8px 0 20px;
    }

    /* ── Alerts ───────────────────────────────────────── */
    .alert {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 18px;

      i { font-size: 17px; flex-shrink: 0; margin-top: 1px; }
    }

    .alert-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
    }

    .alert-success {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #16a34a;
    }

    /* ── Primary button ───────────────────────────────── */
    .btn-primary-full {
      width: 100%;
      padding: 14px 20px;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
      box-shadow: 0 4px 14px rgba(99,102,241,0.35);
      position: relative;
      overflow: hidden;

      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
        opacity: 0;
        transition: opacity 0.2s;
      }

      &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(99,102,241,0.45);
        &::after { opacity: 1; }
      }

      &:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: 0 2px 8px rgba(99,102,241,0.3);
      }

      &:disabled {
        opacity: 0.65;
        cursor: not-allowed;
        transform: none;
      }
    }

    .btn-arrow {
      font-size: 18px;
      transition: transform 0.2s;
    }

    .btn-primary-full:hover .btn-arrow {
      transform: translateX(3px);
    }

    .btn-spinner i {
      font-size: 18px;
    }

    /* ── Spinning animation ───────────────────────────── */
    .spinning {
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    /* ── Text links ───────────────────────────────────── */
    .text-link {
      background: none;
      border: none;
      color: #6366f1;
      font-size: 13px;
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      padding: 0;
      transition: color 0.15s;
      text-decoration: none;

      &:hover { color: #4f46e5; text-decoration: underline; }
    }

    .text-link-bold {
      background: none;
      border: none;
      color: #6366f1;
      font-size: 14px;
      font-family: inherit;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: color 0.15s;

      i { font-size: 14px; }

      &:hover { color: #4f46e5; }
    }

    /* ── Form footer ──────────────────────────────────── */
    .form-footer {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 14px;
      color: #64748b;
    }

    /* ── Forgot password card extras ─────────────────── */
    .back-btn {
      background: none;
      border: none;
      color: #6366f1;
      font-size: 13px;
      font-family: inherit;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 28px;
      transition: color 0.15s;

      i { font-size: 16px; }
      &:hover { color: #4f46e5; }
    }

    .reset-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: linear-gradient(135deg, #ede9fe, #ddd6fe);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;

      i {
        font-size: 24px;
        color: #6366f1;
      }
    }

    /* ── Copyright ────────────────────────────────────── */
    .copyright {
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      margin: 0;
    }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';
  loading = false;
  showPassword = false;
  year = new Date().getFullYear();
  showForgotPassword = false;
  resetEmail = '';
  successMessage = '';
  resetError = '';

  emailFocused = false;
  passwordFocused = false;
  resetFocused = false;

  get shopTitle(): string {
    return this.shopConfig.isConfigured ? this.shopConfig.shopName : 'Sign in';
  }

  constructor(
    private authService: AuthService,
    public shopConfig: ShopConfigService,
    private router: Router
  ) {
    if (this.authService.isLoggedIn) {
      this.router.navigate(['/dashboard']);
    }
  }

  goToRegister() {
    this.router.navigate(['/setup']);
  }

  goToPhoneVerification(phone = this.email.trim()) {
    this.router.navigate(['/verify-phone'], {
      queryParams: phone ? { phone } : undefined
    });
  }

  async sendReset() {
    this.successMessage = '';
    this.resetError = '';
    if (!this.resetEmail.trim()) {
      this.resetError = 'Please enter your email address.';
      return;
    }
    this.loading = true;
    const result = await firstValueFrom(this.authService.sendPasswordResetEmail(this.resetEmail.trim()));
    this.loading = false;
    if (result.success) {
      this.successMessage = result.message;
    } else {
      this.resetError = result.message;
    }
  }

  onLogin() {
    if (!this.email.trim()) {
      this.errorMessage = 'Please enter your email or username';
      return;
    }
    if (!this.password.trim()) {
      this.errorMessage = 'Please enter your password';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login(this.email, this.password).subscribe(result => {
      this.loading = false;
      if (result.success) {
        if (result.requiresSetup) {
          this.router.navigate(['/setup']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      } else if (result.requiresPhoneVerification) {
        this.goToPhoneVerification(result.verificationPhone || this.email.trim());
      } else {
        this.errorMessage = result.message;
      }
    });
  }
}
