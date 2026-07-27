import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ShopConfigService } from '../../services/shop-config.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
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

  get shopTitle(): string {
    return this.shopConfig.isConfigured ? this.shopConfig.shopName : 'Welcome back';
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

  goToRegister(): void {
    this.router.navigate(['/setup']);
  }

  goToPhoneVerification(phone = this.email.trim()): void {
    this.router.navigate(['/verify-phone'], {
      queryParams: phone ? { phone } : undefined
    });
  }

  async sendReset(): Promise<void> {
    this.successMessage = '';
    this.resetError = '';

    if (!this.resetEmail.trim()) {
      this.resetError = 'Please enter your email address.';
      return;
    }

    this.loading = true;
    const result = await firstValueFrom(
      this.authService.sendPasswordResetEmail(this.resetEmail.trim())
    );
    this.loading = false;

    if (result.success) {
      this.successMessage = result.message;
    } else {
      this.resetError = result.message;
    }
  }

  onLogin(): void {
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
        this.router.navigate([result.requiresSetup ? '/setup' : '/dashboard']);
      } else if (result.requiresPhoneVerification) {
        this.goToPhoneVerification(result.verificationPhone || this.email.trim());
      } else {
        this.errorMessage = result.message;
      }
    });
  }
}
