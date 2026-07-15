import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { ShopConfigService } from './services/shop-config.service';
import { ThemeService } from './services/theme.service';
import { ADMIN_NAV_ITEMS, AppResource, MAIN_NAV_ITEMS } from './models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-container" *ngIf="authService.isLoggedIn && shopConfig.isConfigured && !isAuthScreenRoute; else loginView">
      <header class="mobile-topbar">
        <button class="mobile-menu-btn" type="button" (click)="toggleSidebar()" [attr.aria-expanded]="mobileSidebarOpen">
          <span class="material-icons">menu</span>
        </button>
        <div class="mobile-brand">
          <img src="assets/batchcommerce_icon.png" alt="Logo" />
          <div>
            <strong>{{ shopConfig.shopName }}</strong>
            <small>{{ authService.currentUser?.roleName }}</small>
          </div>
        </div>
      </header>

      <div class="sidebar-backdrop" [class.show]="mobileSidebarOpen" (click)="closeSidebar()"></div>

      <aside class="sidebar" [class.sidebar-open]="mobileSidebarOpen">
        <!-- Logo -->
        <div class="sidebar-logo">
          <img src="assets/batchcommerce_icon.png" alt="Logo" class="sidebar-logo-img" />
          <span class="sidebar-logo-text">{{ shopConfig.shopName }}</span>
        </div>

        <!-- User info -->
        <div class="sidebar-user">
          <div class="sidebar-avatar">{{ userInitial }}</div>
          <div class="sidebar-user-info">
            <strong>{{ authService.currentUser?.fullName }}</strong>
            <small>{{ authService.currentUser?.roleName }}</small>
          </div>
        </div>

        <div class="sidebar-workspace">
          <span class="sidebar-workspace-label">Shop</span>
          <strong>{{ shopConfig.shopName }}</strong>
        </div>

        <nav class="sidebar-nav">
          <ng-container *ngFor="let item of mainNav">
            <a *ngIf="canView(item.resource)"
               [routerLink]="item.route" routerLinkActive="active" class="sidebar-item" (click)="closeSidebar()">
              <span class="material-icons">{{ item.icon }}</span>
              <span class="sidebar-item-label">{{ item.label }}</span>
            </a>
          </ng-container>

          <div class="sidebar-divider"></div>

          <ng-container *ngFor="let item of adminNav">
            <a *ngIf="canView(item.resource)"
               [routerLink]="item.route" routerLinkActive="active" class="sidebar-item" (click)="closeSidebar()">
              <span class="material-icons">{{ item.icon }}</span>
              <span class="sidebar-item-label">{{ item.label }}</span>
            </a>
          </ng-container>
        </nav>

        <div class="sidebar-bottom">
          <a (click)="logout()" class="sidebar-item sidebar-logout">
            <span class="material-icons">logout</span>
            <span class="sidebar-item-label">Logout</span>
          </a>
          <div class="sidebar-footer">
            <p>{{ shopConfig.shopName }}</p>
            <small>v1.0.0</small>
          </div>
        </div>
      </aside>

      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>

    <ng-template #loginView>
      <router-outlet></router-outlet>
    </ng-template>
  `,
  styles: [`
    .app-container {
      display: flex;
      min-height: 100vh;
      background: #f7f3eb;
    }

    .mobile-topbar,
    .sidebar-backdrop {
      display: none;
    }

    /* ── Sidebar shell ───────────────────────────────────── */
    .sidebar {
      width: 240px;
      background:
        radial-gradient(circle at 16% 5%, rgba(var(--primary-rgb, 99,102,241), 0.13), transparent 30%),
        radial-gradient(circle at 100% 12%, rgba(15, 118, 110, 0.10), transparent 28%),
        linear-gradient(180deg, #fffdf8 0%, #f8fafc 48%, #f4f0e8 100%);
      border-right: 1px solid rgba(148, 163, 184, 0.35);
      display: flex;
      flex-direction: column;
      position: fixed;
      height: 100vh;
      left: 0;
      top: 0;
      overflow-y: auto;
      z-index: 110;
      scrollbar-width: thin;
      scrollbar-color: rgba(100, 116, 139, 0.32) transparent;
    }

    /* ── Logo ───────────────────────────────────────────── */
    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 18px 14px 14px;
      margin: 0 0 2px;
    }

    .sidebar-logo-img {
      width: 31px;
      height: 31px;
      border-radius: 10px;
      object-fit: cover;
      flex-shrink: 0;
    }

    .sidebar-logo-text {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: -0.03em;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── User badge ─────────────────────────────────────── */
    .sidebar-user {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 6px 10px 10px;
      padding: 12px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.72);
    }

    .sidebar-workspace {
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin: 0 10px 10px;
      padding: 12px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 18px;
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.72), rgba(248, 250, 252, 0.78)),
        radial-gradient(circle at top right, rgba(15, 118, 110, 0.09), transparent 45%);

      .sidebar-workspace-label {
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #0f766e;
      }

      strong {
        font-size: 13px;
        color: #0f172a;
        word-break: break-word;
      }

      small {
        font-size: 10.5px;
        color: #64748b;
        word-break: break-all;
        line-height: 1.35;
      }
    }

    .sidebar-avatar {
      width: 38px;
      height: 38px;
      border-radius: 14px;
      background:
        linear-gradient(135deg, var(--primary-color, #6366f1), #0f766e);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 15px;
      flex-shrink: 0;
    }
    .sidebar-user-info {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      strong { font-size: 12.5px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      small  { font-size: 11px; color: #64748b; margin-top: 2px; }
    }

    /* ── Nav ────────────────────────────────────────────── */
    .sidebar-nav {
      flex: 1;
      padding: 4px 10px 12px;
      overflow-y: auto;
    }

    .sidebar-item {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 39px;
      padding: 9px 11px;
      color: #475569;
      text-decoration: none;
      border: 1px solid transparent;
      border-radius: 13px;
      margin-bottom: 3px;
      transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;
      cursor: pointer;
      font-size: 13px;
      font-weight: 800;

      .material-icons { font-size: 19px; flex-shrink: 0; opacity: 0.9; }
      .sidebar-item-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      &:hover {
        background: rgba(255, 255, 255, 0.78);
        border-color: rgba(var(--primary-rgb, 99,102,241), 0.14);
        color: var(--primary-color, #6366f1);
        transform: translateX(2px);
      }

      &.active {
        background:
          linear-gradient(135deg, var(--primary-color, #6366f1), color-mix(in srgb, var(--primary-color, #6366f1) 72%, #0f766e));
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.45);
        transform: none;
      }
    }

    .sidebar-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(100, 116, 139, 0.28), transparent);
      margin: 12px 6px;
    }

    .sidebar-logout {
      color: #ef4444;
      &:hover {
        background: rgba(254, 242, 242, 0.9) !important;
        border-color: rgba(239, 68, 68, 0.18) !important;
        color: #ef4444 !important;
      }
    }

    /* ── Bottom section ─────────────────────────────────── */
    .sidebar-bottom {
      border-top: 1px solid rgba(148, 163, 184, 0.26);
      padding: 10px 10px 6px;
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.32);
    }

    .sidebar-footer {
      padding: 8px 8px 4px;
      text-align: center;
      color: #94a3b8;
      p     { font-size: 11.5px; margin-bottom: 2px; color: #64748b; }
      small { font-size: 11px; }
    }

    /* ── Main content ────────────────────────────────────── */
    .main-content {
      flex: 1;
      margin-left: 240px;
      padding: 24px;
      background:
        radial-gradient(circle at top right, rgba(15, 118, 110, 0.07), transparent 34rem),
        #f8fafc;
      min-height: 100vh;
      min-width: 0;
    }

    @media (max-width: 920px) {
      .app-container {
        display: block;
        min-height: 100dvh;
        background:
          radial-gradient(circle at top left, rgba(var(--primary-rgb, 99,102,241), 0.10), transparent 34rem),
          #f8fafc;
      }

      .mobile-topbar {
        position: sticky;
        top: 0;
        z-index: 100;
        min-height: 64px;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(255, 253, 248, 0.92);
        backdrop-filter: blur(16px);
      }

      .mobile-menu-btn {
        width: 42px;
        height: 42px;
        border: 1px solid #dbe3ef;
        border-radius: 14px;
        background: #fff;
        color: #0f172a;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .mobile-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .mobile-brand img {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        object-fit: cover;
        flex-shrink: 0;
      }

      .mobile-brand div {
        display: grid;
        min-width: 0;
      }

      .mobile-brand strong {
        color: #0f172a;
        font-size: 14px;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .mobile-brand small {
        color: #64748b;
        font-size: 11px;
      }

      .sidebar {
        width: min(86vw, 320px);
        transform: translateX(-105%);
        transition: transform 0.22s ease;
        border-right: 1px solid #e2e8f0;
      }

      .sidebar.sidebar-open {
        transform: translateX(0);
      }

      .sidebar-backdrop {
        position: fixed;
        inset: 0;
        z-index: 105;
        background: rgba(15, 23, 42, 0.38);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.18s ease;
      }

      .sidebar-backdrop.show {
        display: block;
        opacity: 1;
        pointer-events: auto;
      }

      .main-content {
        margin-left: 0;
        padding: 16px;
        min-height: calc(100dvh - 64px);
      }
    }

    @media (max-width: 520px) {
      .main-content {
        padding: 12px;
      }

      .mobile-topbar {
        padding-inline: 10px;
      }
    }
  `]
})
export class AppComponent {
  title = 'Commerce';
  mobileSidebarOpen = false;

  mainNav = MAIN_NAV_ITEMS;
  adminNav = ADMIN_NAV_ITEMS;

  constructor(
    public authService: AuthService,
    public shopConfig: ShopConfigService,
    private router: Router,
    private themeService: ThemeService
  ) {
    this.themeService.applyTheme();
  }

  get userInitial(): string {
    return this.authService.currentUser?.fullName?.charAt(0).toUpperCase() || '?';
  }

  get isAuthScreenRoute(): boolean {
    const route = this.router.url.split('?')[0];
    return route === '/setup' || route === '/login' || route === '/verify-phone';
  }

  canView(resource: AppResource): boolean {
    return this.authService.canView(resource);
  }

  toggleSidebar() {
    this.mobileSidebarOpen = !this.mobileSidebarOpen;
  }

  closeSidebar() {
    this.mobileSidebarOpen = false;
  }

  logout() {
    this.closeSidebar();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
