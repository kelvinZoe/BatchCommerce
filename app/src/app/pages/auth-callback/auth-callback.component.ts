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
          <span class="logo-icon">🛒</span>
          <h1>Signing you in...</h1>
          <p>Please wait while we complete your authentication.</p>
        </div>

        <div class="loading-spinner">
          <div class="spinner"></div>
        </div>

        <div class="error-message" *ngIf="errorMessage">
          <span class="material-icons">error</span>
          {{ errorMessage }}
          <button class="retry-btn" (click)="retry()">Try again</button>
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
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      padding: 20px;
    }

    .callback-card {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 100%;
      max-width: 420px;
      overflow: hidden;
      text-align: center;
      padding: 40px 32px;
    }

    .callback-header {
      margin-bottom: 32px;

      .logo-icon {
        font-size: 48px;
        display: block;
        margin-bottom: 16px;
      }

      h1 {
        font-size: 24px;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 8px;
      }

      p {
        color: #64748b;
        font-size: 14px;
      }
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      margin-bottom: 24px;

      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #e2e8f0;
        border-top: 4px solid #2563eb;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
    }

    .error-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 10px;
      color: #dc2626;
      font-size: 14px;

      .material-icons {
        font-size: 24px;
      }
    }

    .retry-btn {
      padding: 8px 16px;
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;

      &:hover {
        background: #b91c1c;
      }
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `]
})
export class AuthCallbackComponent implements OnInit {
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private shopConfig: ShopConfigService,
    private router: Router
  ) {}

  ngOnInit() {
    this.handleCallback();
  }

  private async handleCallback() {
    try {
      const result = await this.authService.handleOAuthCallback().toPromise();
      
      if (result && result.success) {
        if (result.requiresSetup) {
          this.router.navigate(['/setup']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      } else {
        this.errorMessage = result?.message || 'Authentication failed';
      }
    } catch (err: any) {
      this.errorMessage = err?.message || 'Authentication failed';
    }
  }

  retry() {
    this.errorMessage = '';
    this.handleCallback();
  }
}
