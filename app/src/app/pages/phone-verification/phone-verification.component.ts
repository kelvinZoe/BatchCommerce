import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-phone-verification',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pv-page">
      <div class="pv-card">
        <div class="pv-header">
          <div class="pv-badge">WhatsApp OTP</div>
          <div class="pv-mark">
            <span class="material-icons">verified_user</span>
          </div>
          <h1>Verify your invited account</h1>
          <p>Enter your phone number and the code sent to your WhatsApp to activate shop access.</p>
        </div>

        <div class="pv-panel">
          <div class="pv-info" *ngIf="infoMessage">
            <span class="material-icons">info</span>
            <span>{{ infoMessage }}</span>
          </div>

          <div class="pv-success" *ngIf="successMessage">
            <span class="material-icons">check_circle</span>
            <span>{{ successMessage }}</span>
          </div>

          <div class="pv-error" *ngIf="errorMessage">
            <span class="material-icons">error</span>
            <span>{{ errorMessage }}</span>
          </div>

          <div class="pv-field">
            <label>Phone Number</label>
            <input
              type="tel"
              [(ngModel)]="phone"
              placeholder="e.g. +233241234567"
              autocomplete="tel"
              (keydown)="clearMessages()"
            />
            <small>Local Ghana numbers like 0241234567 are converted automatically.</small>
          </div>

          <div class="pv-field">
            <label>Verification Code</label>
            <input
              type="text"
              [(ngModel)]="code"
              placeholder="Enter the 6-digit code"
              inputmode="numeric"
              maxlength="6"
              autocomplete="one-time-code"
              (keydown)="clearMessages()"
            />
          </div>

          <div class="pv-actions pv-actions-primary">
            <button class="pv-btn pv-btn-secondary" type="button" (click)="sendCode()" [disabled]="sending || verifying">
              <span class="material-icons" *ngIf="!sending">chat</span>
              <span class="material-icons pv-spin" *ngIf="sending">sync</span>
              {{ sending ? 'Sending code...' : 'Send / Resend Code' }}
            </button>
            <button class="pv-btn pv-btn-primary" type="button" (click)="verifyCode()" [disabled]="verifying || sending">
              <span class="material-icons pv-spin" *ngIf="verifying">sync</span>
              <span class="material-icons" *ngIf="!verifying">verified</span>
              {{ verifying ? 'Verifying...' : 'Verify and Sign In' }}
            </button>
          </div>

          <div class="pv-divider"></div>

          <div class="pv-actions pv-actions-secondary">
            <button class="pv-link" type="button" (click)="goToLogin()">Back to login</button>
            <span class="pv-note">Your shop admin can resend the code from Users if needed.</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --pv-ink: #102136;
      --pv-muted: #5e6c80;
      --pv-line: rgba(148, 163, 184, 0.28);
      --pv-blue: #155eef;
      --pv-blue-deep: #0f4bcc;
      --pv-blue-soft: #eff6ff;
      --pv-green-soft: #ecfdf5;
      --pv-green-ink: #166534;
      --pv-red-soft: #fef2f2;
      --pv-red-ink: #b42318;
      --pv-bg: linear-gradient(140deg, #0f172a 0%, #13233d 36%, #1d4ed8 100%);
    }

    .pv-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background:
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.08), transparent 28%),
        radial-gradient(circle at bottom right, rgba(255, 255, 255, 0.12), transparent 30%),
        var(--pv-bg);
    }

    .pv-card {
      width: 100%;
      max-width: 520px;
      border-radius: 24px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 26px 80px rgba(2, 8, 23, 0.32);
      border: 1px solid rgba(255, 255, 255, 0.24);
      backdrop-filter: blur(16px);
    }

    .pv-header {
      position: relative;
      padding: 32px 32px 24px;
      background:
        linear-gradient(180deg, rgba(239, 246, 255, 0.98), rgba(255, 255, 255, 0.95)),
        linear-gradient(120deg, rgba(21, 94, 239, 0.15), transparent 60%);
      border-bottom: 1px solid rgba(148, 163, 184, 0.18);
    }

    .pv-badge {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(21, 94, 239, 0.1);
      color: var(--pv-blue);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .pv-mark {
      margin-top: 18px;
      width: 56px;
      height: 56px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #155eef, #0f4bcc);
      color: #fff;
      box-shadow: 0 12px 32px rgba(21, 94, 239, 0.3);
    }

    .pv-mark .material-icons {
      font-size: 28px;
    }

    .pv-header h1 {
      margin: 18px 0 8px;
      font-size: 28px;
      line-height: 1.1;
      letter-spacing: -0.03em;
      color: var(--pv-ink);
      font-weight: 800;
    }

    .pv-header p {
      margin: 0;
      color: var(--pv-muted);
      font-size: 14px;
      line-height: 1.6;
      max-width: 400px;
    }

    .pv-panel {
      padding: 28px 32px 30px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .pv-info,
    .pv-success,
    .pv-error {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid transparent;
    }

    .pv-info { background: var(--pv-blue-soft); color: #1d4ed8; border-color: #bfdbfe; }
    .pv-success { background: var(--pv-green-soft); color: var(--pv-green-ink); border-color: #bbf7d0; }
    .pv-error { background: var(--pv-red-soft); color: var(--pv-red-ink); border-color: #fecaca; }

    .pv-info .material-icons,
    .pv-success .material-icons,
    .pv-error .material-icons {
      font-size: 18px;
      margin-top: 1px;
    }

    .pv-field {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .pv-field label {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--pv-muted);
    }

    .pv-field input {
      width: 100%;
      box-sizing: border-box;
      border-radius: 14px;
      border: 1px solid var(--pv-line);
      background: #f8fafc;
      color: var(--pv-ink);
      padding: 14px 15px;
      font-size: 14px;
      transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
    }

    .pv-field input:focus {
      outline: none;
      border-color: rgba(21, 94, 239, 0.45);
      box-shadow: 0 0 0 4px rgba(21, 94, 239, 0.12);
      background: #fff;
    }

    .pv-field small {
      color: var(--pv-muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .pv-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .pv-actions-primary {
      margin-top: 4px;
    }

    .pv-actions-secondary {
      gap: 12px;
    }

    .pv-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-radius: 14px;
      border: 1px solid transparent;
      padding: 13px 16px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
      min-width: 180px;
    }

    .pv-btn:disabled {
      opacity: 0.6;
      cursor: default;
      transform: none;
      box-shadow: none;
    }

    .pv-btn-primary {
      background: linear-gradient(135deg, var(--pv-blue), var(--pv-blue-deep));
      color: #fff;
      box-shadow: 0 14px 28px rgba(21, 94, 239, 0.22);
    }

    .pv-btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
    }

    .pv-btn-secondary {
      background: #fff;
      border-color: #cfe0ff;
      color: var(--pv-blue);
    }

    .pv-btn-secondary:hover:not(:disabled) {
      background: #f8fbff;
      transform: translateY(-1px);
    }

    .pv-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.4), transparent);
      margin: 4px 0 2px;
    }

    .pv-link {
      border: none;
      background: transparent;
      color: var(--pv-blue);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      padding: 0;
    }

    .pv-note {
      color: var(--pv-muted);
      font-size: 12px;
      line-height: 1.5;
      text-align: right;
      flex: 1;
    }

    .pv-spin {
      animation: pv-spin 0.8s linear infinite;
    }

    @keyframes pv-spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 640px) {
      .pv-page {
        padding: 14px;
      }

      .pv-header,
      .pv-panel {
        padding-left: 20px;
        padding-right: 20px;
      }

      .pv-header h1 {
        font-size: 24px;
      }

      .pv-btn {
        width: 100%;
      }

      .pv-note {
        text-align: left;
      }
    }
  `]
})
export class PhoneVerificationComponent implements OnInit {
  phone = '';
  code = '';
  sending = false;
  verifying = false;
  errorMessage = '';
  infoMessage = '';
  successMessage = '';

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const phone = this.route.snapshot.queryParamMap.get('phone');
    if (phone) {
      this.phone = phone;
      this.infoMessage = 'Use the phone number your shop admin invited. You can resend the code here if needed.';
    }
  }

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  sendCode(): void {
    this.clearMessages();
    this.infoMessage = '';
    this.sending = true;
    this.authService.sendPhoneVerificationOtp(this.phone, 'whatsapp').subscribe(result => {
      this.sending = false;
      if (result.success) {
        this.phone = result.phone || this.phone;
        this.successMessage = result.message;
      } else {
        this.errorMessage = result.message;
      }
    });
  }

  verifyCode(): void {
    this.clearMessages();
    this.infoMessage = '';
    this.verifying = true;
    this.authService.verifyPhoneOtp(this.phone, this.code).subscribe(result => {
      this.verifying = false;
      if (result.success) {
        if (result.requiresSetup) {
          this.router.navigate(['/setup']);
          return;
        }

        this.router.navigate(['/dashboard']);
        return;
      }

      this.errorMessage = result.message;
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}