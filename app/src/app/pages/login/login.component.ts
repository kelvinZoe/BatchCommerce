import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ShopConfigService } from '../../services/shop-config.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <span class="logo-icon">🛒</span>
          <h1>{{ shopTitle }}</h1>
          <p>{{ shopConfig.isConfigured ? 'Sign in to continue' : 'Sign in or create a new shop' }}</p>
        </div>

        <form (ngSubmit)="onLogin()" class="login-form">
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
            <label>Email or Username</label>
            <div class="input-icon">
              <span class="material-icons">alternate_email</span>
              <input
                type="text"
                [(ngModel)]="email"
                name="email"
                placeholder="Enter your email or username"
                autocomplete="username"
                (keydown)="errorMessage = ''"
              />
            </div>
            <small class="login-hint" *ngIf="shopConfig.isConfigured">
              Use the verified email address on the account invite. Existing usernames are still matched to {{ shopConfig.shopName }} automatically.
            </small>
          </div>

          <div class="form-group">
            <label>Password</label>
            <div class="input-icon">
              <span class="material-icons">lock</span>
              <input
                [type]="showPassword ? 'text' : 'password'"
                [(ngModel)]="password"
                name="password"
                placeholder="Enter your password"
                autocomplete="current-password"
                (keydown)="errorMessage = ''"
              />
              <button
                type="button"
                class="toggle-password"
                (click)="showPassword = !showPassword">
                <span class="material-icons">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
          </div>

          <div class="error-message" *ngIf="errorMessage">
            <span class="material-icons">error</span>
            {{ errorMessage }}
          </div>

          <button type="submit" class="btn btn-primary login-btn" [disabled]="loading">
            <span class="material-icons spin" *ngIf="loading">sync</span>
            <span *ngIf="!loading">Continue</span>
            <span *ngIf="loading">Signing in...</span>
          </button>

          <button type="button" class="btn btn-secondary register-btn" (click)="goToRegister()" [disabled]="loading">
            Create a new shop
          </button>
        </form>

        <div class="login-footer">
          <small>{{ shopConfig.shopName }} &copy; {{ year }}</small>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      padding: 20px;
    }

    .login-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 100%;
      max-width: 420px;
      overflow: hidden;
    }

    .login-header {
      text-align: center;
      padding: 40px 32px 24px;

      .logo-icon {
        font-size: 48px;
        display: block;
        margin-bottom: 16px;
      }

      h1 {
        font-size: 24px;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 4px;
      }

      p {
        color: #64748b;
        font-size: 14px;
      }

    }

    .login-form {
      padding: 8px 32px 32px;
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
        display: block;
        margin-bottom: 6px;
        font-size: 14px;
        font-weight: 500;
        color: #334155;
      }
    }

    .login-hint {
      display: block;
      margin-top: 8px;
      color: #64748b;
      font-size: 12px;
      line-height: 1.4;
    }

    .input-icon {
      position: relative;
      display: flex;
      align-items: center;

      .material-icons {
        position: absolute;
        left: 14px;
        color: #94a3b8;
        font-size: 20px;
        pointer-events: none;
      }

      input {
        width: 100%;
        padding: 12px 14px 12px 44px;
        border: 1.5px solid #e2e8f0;
        border-radius: 10px;
        font-size: 14px;
        transition: all 0.2s ease;
        background: #f8fafc;

        &:focus {
          outline: none;
          border-color: #2563eb;
          background: white;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
      }

      .toggle-password {
        position: absolute;
        right: 10px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;

        .material-icons {
          position: static;
          color: #94a3b8;
          pointer-events: auto;
        }

        &:hover .material-icons {
          color: #475569;
        }
      }
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 10px;
      color: #dc2626;
      font-size: 13px;
      margin-bottom: 20px;

      .material-icons {
        font-size: 18px;
      }
    }

    .login-btn {
      width: 100%;
      padding: 14px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .register-btn {
      width: 100%;
      margin-top: 12px;
      padding: 13px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 10px;
      border: 1px solid #cbd5e1;
      background: white;
      color: #334155;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .login-footer {
      text-align: center;
      padding: 16px;
      border-top: 1px solid #f1f5f9;

      small {
        color: #94a3b8;
        font-size: 12px;
      }
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

  get shopTitle(): string {
    return this.shopConfig.isConfigured ? this.shopConfig.shopName : 'Welcome back';
  }

  constructor(private authService: AuthService, public shopConfig: ShopConfigService, private router: Router) {
    // If already logged in, redirect
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
        if (result.requiresSetup || !this.shopConfig.isConfigured) {
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
