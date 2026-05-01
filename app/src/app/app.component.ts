import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { ShopConfigService } from './services/shop-config.service';
import { ThemeService } from './services/theme.service';
import { AppResource } from './models';

interface NavItem {
  route: string;
  icon: string;
  label: string;
  resource: AppResource;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-container" *ngIf="authService.isLoggedIn && shopConfig.isConfigured && !isAuthScreenRoute; else loginView">
      <aside class="sidebar">
        <!-- Logo -->
        <div class="sidebar-logo">
          <span class="sidebar-logo-icon">🛒</span>
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
               [routerLink]="item.route" routerLinkActive="active" class="sidebar-item">
              <span class="material-icons">{{ item.icon }}</span>
              <span class="sidebar-item-label">{{ item.label }}</span>
            </a>
          </ng-container>

          <div class="sidebar-divider"></div>

          <ng-container *ngFor="let item of adminNav">
            <a *ngIf="canView(item.resource)"
               [routerLink]="item.route" routerLinkActive="active" class="sidebar-item">
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
    }

    /* ── Logo ───────────────────────────────────────────── */
    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 18px;
      border-bottom: 1px solid #ccc;
    }
    .sidebar-logo-icon { font-size: 26px; }
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
    }
  `]
})
export class AppComponent {
  title = 'Commerce';

  mainNav: NavItem[] = [
    { route: '/dashboard',        icon: 'dashboard',        label: 'Dashboard',        resource: 'dashboard' },
    { route: '/clients',          icon: 'people',           label: 'Clients',          resource: 'clients' },
    { route: '/products',         icon: 'inventory_2',      label: 'Products',         resource: 'products' },
    { route: '/orders',           icon: 'shopping_cart',    label: 'Orders',           resource: 'orders' },
    { route: '/buying-list',      icon: 'shopping_bag',     label: 'Buying List',      resource: 'buying_list' },
    { route: '/arrivals',         icon: 'inventory',        label: 'Arrivals',         resource: 'arrivals' },
    { route: '/product-tracking', icon: 'track_changes',    label: 'Tracking',         resource: 'product_tracking' },
    { route: '/shipping',         icon: 'paid',             label: 'Shipping',         resource: 'shipping' },
    { route: '/shipping-ledger',  icon: 'local_shipping',   label: 'Shipping Ledger',  resource: 'shipping' },
    { route: '/deliveries',       icon: 'local_shipping',   label: 'Deliveries',       resource: 'deliveries' },
    { route: '/stock-sales',       icon: 'storefront',       label: 'Stock Sales',      resource: 'stock_sales' },
    { route: '/damaged-items',    icon: 'report_problem',   label: 'Damaged Items',    resource: 'damaged_items' },
    { route: '/reports',          icon: 'analytics',        label: 'Reports',          resource: 'reports' },
  ];

  adminNav: NavItem[] = [
    { route: '/import',   icon: 'upload_file',          label: 'Import Data',        resource: 'import' },
    { route: '/batches',  icon: 'inventory_2',          label: 'Manage Batches',     resource: 'batches' },
    { route: '/users',    icon: 'manage_accounts',      label: 'Users',              resource: 'users' },
    { route: '/roles',    icon: 'admin_panel_settings',  label: 'Roles & Permissions', resource: 'roles' },
    { route: '/settings', icon: 'settings',              label: 'Settings',           resource: 'settings' },
  ];

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

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
