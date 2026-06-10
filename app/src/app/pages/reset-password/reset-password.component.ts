import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reset-page">
      <div class="reset-card">
        <div class="reset-header">
          <img src="assets/batchcommerce_icon.png" alt="Logo" class="logo-icon" />
          <h1>Set New Password</h1>
          <p>Enter a new password for your account.</p>
        </div>

        <div class="reset-body">
          <div *ngIf="successMessage" class="success-message">
            <span class="material-icons">check_circle</span>
            {{ successMessage }}
            <button class="btn btn-primary" style="margin-top:16px;width:100%" (click)="goToLogin()">
              Sign in
            </button>
          </div>

          <ng-container *ngIf="!successMessage">
            <div class="form-group">
              <label>New Password</label>
              <div class="input-icon">
                <span class="material-icons">lock</span>
                <input
                  [type]="showPassword ? 'text' : 'password'"
                  [(ngModel)]="password"
                  name="password"
                  placeholder="At least 6 characters"
                  autocomplete="new-password"
                />
                <button type="button" class="toggle-password" (click)="showPassword = !showPassword">
                  <span class="material-icons">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
                </button>
              </div>
            </div>

            <div class="form-group">
              <label>Confirm Password</label>
              <div class="input-icon">
                <span class="material-icons">lock</span>
                <input
                  [type]="showPassword ? 'text' : 'password'"
                  [(ngModel)]="confirmPassword"
                  name="confirmPassword"
                  placeholder="Repeat your password"
                  autocomplete="new-password"
                />
              </div>
            </div>

            <div class="error-message" *ngIf="errorMessage">
              <span class="material-icons">error</span>
              {{ errorMessage }}
            </div>

            <button class="btn btn-primary submit-btn" (click)="submit()" [disabled]="loading">
              <span class="material-icons spin" *ngIf="loading">sync</span>
              <span *ngIf="!loading">Update Password</span>
              <span *ngIf="loading">Updating...</span>
            </button>
          </ng-container>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reset-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      padding: 20px;
    }

    .reset-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      width: 100%;
      max-width: 420px;
      overflow: hidden;
    }

    .reset-header {
      text-align: center;
      padding: 40px 32px 24px;
      .logo-icon { width: 56px; height: 56px; border-radius: 12px; display: block; margin: 0 auto 16px; box-shadow: 0 4px 16px rgba(99, 102, 241, 0.25); }
      h1 { font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
      p { color: #64748b; font-size: 14px; }
    }

    .reset-body {
      padding: 8px 32px 32px;
    }

    .form-group {
      margin-bottom: 20px;
      label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    }

    .input-icon {
      position: relative;
      display: flex;
      align-items: center;
      .material-icons:first-child {
        position: absolute;
        left: 12px;
        color: #94a3b8;
        font-size: 18px;
        pointer-events: none;
      }
      input {
        width: 100%;
        padding: 11px 40px 11px 38px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        font-size: 14px;
        box-sizing: border-box;
        &:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
      }
      .toggle-password {
        position: absolute;
        right: 10px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        .material-icons { color: #94a3b8; font-size: 18px; }
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
      margin-bottom: 16px;
      .material-icons { font-size: 18px; }
    }

    .success-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      color: #16a34a;
      font-size: 14px;
      text-align: center;
      .material-icons { font-size: 32px; }
    }

    .submit-btn {
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

    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `]
})
export class ResetPasswordComponent implements OnInit {
  password = '';
  confirmPassword = '';
  showPassword = false;
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    // Supabase puts the token in the URL hash as access_token when coming from reset link.
    // The Supabase client automatically picks it up via detectSessionInUrl.
    // Nothing extra needed here — updateUser() will use the active session.
  }

  async submit() {
    this.errorMessage = '';
    if (!this.password.trim()) {
      this.errorMessage = 'Please enter a new password.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }
    this.loading = true;
    const result = await firstValueFrom(this.authService.updatePassword(this.password));
    this.loading = false;
    if (result.success) {
      this.successMessage = 'Your password has been updated. You can now sign in.';
    } else {
      this.errorMessage = result.message;
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
