import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  template: `
    <section class="access-page">
      <div class="access-card">
        <span class="material-icons access-icon" aria-hidden="true">lock</span>
        <p class="eyebrow">Workspace access</p>
        <h1>No pages have been assigned to this role</h1>
        <p class="description">
          Your sign-in worked, but your workspace role does not currently have permission to view any page.
          Ask a workspace administrator to update your role permissions, then sign in again.
        </p>
        <button type="button" (click)="signOut()">
          <span class="material-icons" aria-hidden="true">logout</span>
          Sign out
        </button>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .access-page {
      min-height: calc(100vh - 3px);
      display: grid;
      place-items: center;
      padding: 32px;
      background: #f7f3eb;
    }
    .access-card {
      width: min(560px, 100%);
      padding: 44px;
      border: 1px solid rgba(14, 58, 52, 0.12);
      border-radius: 24px;
      background: #fffdf8;
      box-shadow: 0 24px 70px rgba(20, 56, 50, 0.12);
      text-align: center;
    }
    .access-icon {
      display: inline-grid;
      place-items: center;
      width: 64px;
      height: 64px;
      border-radius: 20px;
      color: #0f766e;
      background: #dff4ef;
      font-size: 30px;
    }
    .eyebrow {
      margin: 22px 0 8px;
      color: #b27613;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      color: #123b36;
      font-size: clamp(28px, 4vw, 38px);
      line-height: 1.1;
    }
    .description {
      margin: 18px auto 28px;
      max-width: 470px;
      color: #55706c;
      font-size: 16px;
      line-height: 1.65;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 12px 20px;
      border: 0;
      border-radius: 12px;
      color: white;
      background: #123b36;
      font: inherit;
      font-weight: 650;
      cursor: pointer;
    }
    button:hover { background: #0b2f2b; }
    button:focus-visible {
      outline: 3px solid rgba(20, 184, 166, 0.35);
      outline-offset: 3px;
    }
    @media (max-width: 600px) {
      .access-page { padding: 20px; }
      .access-card { padding: 32px 22px; }
    }
  `]
})
export class AccessDeniedComponent {
  constructor(private auth: AuthService, private router: Router) {}

  signOut(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
