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
          <img src="assets/batchcommerce_icon.png" alt="Logo" style="width: 28px; height: 28px; border-radius: 6px; object-fit: cover; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25); flex-shrink: 0;" />
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
          <small *ngIf="shopConfig.shopId">{{ shopConfig.shopId }}</small>
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
    }

    .mobile-topbar,
    .sidebar-backdrop {
      display: none;
    }

    /* ── Sidebar shell ───────────────────────────────────── */
    .sidebar {
      width: 240px;
      background: #ffffff;
      border-right: 1px solid #ccc;
      display: flex;
      flex-direction: column;
      position: fixed;
      height: 100vh;
      left: 0;
      top: 0;
      overflow-y: auto;
      z-index: 110;
    }

    /* ── Logo ───────────────────────────────────────────── */
    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 18px;
      border-bottom: 1px solid #ccc;
    }
    .sidebar-logo-text {
      font-size: 18px;
      font-weight: 700;
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
      padding: 14px 18px;
      border-bottom: 1px solid #ccc;
    }

    .sidebar-workspace {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 12px 18px;
      border-bottom: 1px solid #ccc;
      background: #f8fafc;

      .sidebar-workspace-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #94a3b8;
      }

      strong {
        font-size: 13px;
        color: #0f172a;
        word-break: break-word;
      }

      small {
        font-size: 11px;
        color: #64748b;
        word-break: break-all;
      }
    }

    .sidebar-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--primary-color, #6366f1);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 15px;
      flex-shrink: 0;
    }
    .sidebar-user-info {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      strong { font-size: 13px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      small  { font-size: 11px; color: #94a3b8; margin-top: 1px; }
    }

    /* ── Nav ────────────────────────────────────────────── */
    .sidebar-nav {
      flex: 1;
      padding: 10px 10px;
      overflow-y: auto;
    }

    .sidebar-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      color: #475569;
      text-decoration: none;
      border-radius: 8px;
      margin-bottom: 2px;
      transition: background 0.15s, color 0.15s;
      cursor: pointer;
      font-size: 13.5px;
      font-weight: 500;

      .material-icons { font-size: 20px; flex-shrink: 0; }
      .sidebar-item-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      &:hover {
        background: rgba(var(--primary-rgb, 99,102,241), 0.08);
        color: var(--primary-color, #6366f1);
      }

      &.active {
        background: var(--primary-color, #6366f1);
        color: #ffffff;
      }
    }

    .sidebar-divider {
      height: 1px;
      background: #ccc;
      margin: 10px 4px;
    }

    .sidebar-logout {
      color: #ef4444;
      &:hover { background: rgba(239,68,68,0.08) !important; color: #ef4444 !important; }
    }

    /* ── Bottom section ─────────────────────────────────── */
    .sidebar-bottom {
      border-top: 1px solid #ccc;
      padding: 10px 10px 6px;
      flex-shrink: 0;
    }

    .sidebar-footer {
      padding: 8px 8px 4px;
      text-align: center;
      color: #94a3b8;
      p     { font-size: 12px; margin-bottom: 2px; }
      small { font-size: 11px; }
    }

    /* ── Main content ────────────────────────────────────── */
    .main-content {
      flex: 1;
      margin-left: 240px;
      padding: 24px;
      background: #f8fafc;
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
        background: rgba(248, 250, 252, 0.92);
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
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
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
        box-shadow: 18px 0 40px rgba(15, 23, 42, 0.18);
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
