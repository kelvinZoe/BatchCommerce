import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ShopConfigService } from '../../services/shop-config.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="auth-callback-page">
      <div class="callback-card">
        <div class="callback-header">
          <img src="assets/batchcommerce_icon.svg" alt="Batch Commerce logo" class="logo-icon" />
          <h1>{{ statusTitle }}</h1>
          <p *ngIf="statusSubtitle">{{ statusSubtitle }}</p>
        </div>

        <div class="loading-spinner" *ngIf="loading">
          <div class="spinner"></div>
        </div>

        <div class="error-box" *ngIf="errorMessage && !loading">
          <div class="error-icon">✗</div>
          <p class="error-text">{{ errorMessage }}</p>

          <div class="error-actions">
            <button class="btn-primary" (click)="goToSetup()" *ngIf="showSetupLink">
              Back to Sign Up
            </button>
            <button class="btn-secondary" (click)="goToLogin()">
              Sign In Instead
            </button>
          </div>
        </div>

        <div class="success-box" *ngIf="successMessage && !loading">
          <div class="success-icon">✓</div>
          <p>{{ successMessage }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-callback-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%);
      padding: 20px;
    }

    .callback-card {
      background: white;
      border-radius: 20px;
      width: 100%;
      max-width: 440px;
      text-align: center;
      padding: 44px 36px;
    }

    .callback-header {
      margin-bottom: 28px;

      .logo-icon {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        display: block;
        margin: 0 auto 16px;
      }

      h1 {
        font-size: 22px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 8px;
      }

      p {
        color: #64748b;
        font-size: 14px;
        margin: 0;
      }
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      margin: 8px 0 24px;

      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #e2e8f0;
        border-top: 4px solid #2563eb;
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
      }
    }

    .error-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 20px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 12px;

      .error-icon {
        font-size: 20px;
        color: #dc2626;
        font-weight: 700;
        width: 44px;
        height: 44px;
        background: #fee2e2;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .error-text {
        color: #991b1b;
        font-size: 14px;
        margin: 0;
        line-height: 1.6;
      }

      .error-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
        margin-top: 4px;
      }
    }

    .success-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      color: #166534;
      font-size: 14px;

      .success-icon {
        font-size: 20px;
        font-weight: 700;
        width: 44px;
        height: 44px;
        background: #dcfce7;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      p { margin: 0; }
    }

    .btn-primary {
      padding: 10px 20px;
      background: #0f172a;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      &:hover { background: #1e293b; }
    }

    .btn-secondary {
      padding: 10px 20px;
      background: transparent;
      color: #0f172a;
      border: 2px solid #cbd5e1;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: border-color 0.2s;
      &:hover { border-color: #94a3b8; }
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `]
})
export class AuthCallbackComponent implements OnInit {
  loading = true;
  statusTitle = 'Signing you in...';
  statusSubtitle = 'Please wait while we complete your authentication.';
  errorMessage = '';
  successMessage = '';
  showSetupLink = false;

  constructor(
    private authService: AuthService,
    private shopConfig: ShopConfigService,
    private router: Router
  ) {}

  ngOnInit() {
    this.handleCallback();
  }

  private async handleCallback() {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, ''));

    // ── Case 1: Supabase returned an error in the URL hash ──────────────────
    // e.g. #error=access_denied&error_code=otp_expired&error_description=...
    if (params.get('error')) {
      const code = params.get('error_code') || params.get('error') || '';
      const desc = params.get('error_description') || 'The link is invalid or has expired.';

      this.loading = false;
      this.statusTitle = 'Link Expired';
      this.statusSubtitle = '';
      this.showSetupLink = true;

      if (code === 'otp_expired' || desc.toLowerCase().includes('expired')) {
        this.errorMessage =
          'Your email verification link has expired — links are only valid for 24 hours. ' +
          'Please go back to Sign Up and try again. Your shop name will be remembered.';
      } else {
        this.errorMessage = decodeURIComponent(desc.replace(/\+/g, ' '));
      }
      return;
    }

    // ── Case 2: Password reset / recovery link ───────────────────────────────
    if (params.get('type') === 'recovery') {
      this.router.navigate(['/reset-password']);
      return;
    }

    // ── Case 3: Email confirmation link (type=signup) ────────────────────────
    // Supabase embeds access_token + refresh_token in the hash.
    // The Supabase JS client exchanges them automatically via getSession().
    if (params.get('type') === 'signup' || params.get('access_token')) {
      this.statusTitle = 'Verifying your email...';
      this.statusSubtitle = 'Almost there!';
      try {
        const result = await this.authService.handleOAuthCallback().toPromise();
        if (result && result.success) {
          if (result.requiresSetup) {
            this.router.navigate(['/setup']);
          } else {
            this.router.navigate(['/dashboard']);
          }
        } else {
          this.loading = false;
          this.statusTitle = 'Verification Failed';
          this.statusSubtitle = '';
          this.errorMessage = result?.message || 'Could not complete email verification.';
          this.showSetupLink = true;
        }
      } catch (err: any) {
        this.loading = false;
        this.statusTitle = 'Verification Failed';
        this.statusSubtitle = '';
        this.errorMessage = err?.message || 'Could not complete email verification.';
        this.showSetupLink = true;
      }
      return;
    }

    // ── Case 4: OAuth provider callback (Google, GitHub, etc.) ──────────────
    try {
      const result = await this.authService.handleOAuthCallback().toPromise();
      if (result && result.success) {
        if (result.requiresSetup) {
          this.router.navigate(['/setup']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      } else {
        this.loading = false;
        this.statusTitle = 'Sign In Failed';
        this.statusSubtitle = '';
        this.errorMessage = result?.message || 'Authentication failed.';
      }
    } catch (err: any) {
      this.loading = false;
      this.statusTitle = 'Sign In Failed';
      this.statusSubtitle = '';
      this.errorMessage = err?.message || 'Authentication failed.';
    }
  }

  goToSetup() {
    this.router.navigate(['/setup']);
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
