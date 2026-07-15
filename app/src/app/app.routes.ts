import { Routes } from '@angular/router';
import { authGuard, permissionGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'setup',
    loadComponent: () => import('./pages/setup/setup.component').then(m => m.SetupComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'verify-phone',
    loadComponent: () => import('./pages/phone-verification/phone-verification.component').then(m => m.PhoneVerificationComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard, permissionGuard('dashboard')]
  },
  {
    path: 'arrivals',
    loadComponent: () => import('./pages/arrivals/arrivals.component').then(m => m.ArrivalsComponent),
    canActivate: [authGuard, permissionGuard('arrivals')]
  },
  {
    path: 'product-tracking',
    loadComponent: () => import('./pages/product-tracking').then(m => m.ProductTrackingComponent),
    canActivate: [authGuard, permissionGuard('product_tracking')]
  },
  {
    path: 'damaged-items',
    loadComponent: () => import('./pages/damaged-items/damaged-items.component').then(m => m.DamagedItemsComponent),
    canActivate: [authGuard, permissionGuard('damaged_items')]
  },
  {
    path: 'reports',
    loadComponent: () => import('./pages/reports/reports.component').then(m => m.ReportsComponent),
    canActivate: [authGuard, permissionGuard('reports')]
  },
  {
    path: 'products',
    loadComponent: () => import('./pages/products/products.component').then(m => m.ProductsComponent),
    canActivate: [authGuard, permissionGuard('products')]
  },
  {
    path: 'clients',
    loadComponent: () => import('./pages/clients/clients.component').then(m => m.ClientsComponent),
    canActivate: [authGuard, permissionGuard('clients')]
  },
  {
    path: 'orders',
    loadComponent: () => import('./pages/orders/orders.component').then(m => m.OrdersComponent),
    canActivate: [authGuard, permissionGuard('orders')]
  },
  {
    path: 'deliveries',
    loadComponent: () => import('./pages/deliveries/deliveries.component').then(m => m.DeliveriesComponent),
    canActivate: [authGuard, permissionGuard('deliveries')]
  },
  {
    path: 'stock-sales',
    loadComponent: () => import('./pages/stock-sales/stock-sales.component').then(m => m.StockSalesComponent),
    canActivate: [authGuard, permissionGuard('stock_sales')]
  },
  {
    path: 'shipping',
    loadComponent: () => import('./pages/shipping/shipping.component').then(m => m.ShippingComponent),
    canActivate: [authGuard, permissionGuard('shipping')]
  },
  {
    path: 'shipping-ledger',
    loadComponent: () => import('./pages/shipping-ledger/shipping-ledger.component').then(m => m.ShippingLedgerComponent),
    canActivate: [authGuard, permissionGuard('shipping')]
  },
  {
    path: 'buying-list',
    loadComponent: () => import('./pages/buying-list/buying-list.component').then(m => m.BuyingListComponent),
    canActivate: [authGuard, permissionGuard('buying_list')]
  },
  {
    path: 'expenses',
    loadComponent: () => import('./pages/expenses/expenses.component').then(m => m.ExpensesComponent),
    canActivate: [authGuard, permissionGuard('expenses')]
  },
  {
    path: 'import',
    loadComponent: () => import('./pages/import/import.component').then(m => m.ImportComponent),
    canActivate: [authGuard, permissionGuard('import')]
  },
  {
    path: 'users',
    loadComponent: () => import('./pages/users/users.component').then(m => m.UsersComponent),
    canActivate: [authGuard, permissionGuard('users')]
  },
  {
    path: 'roles',
    loadComponent: () => import('./pages/roles/roles.component').then(m => m.RolesComponent),
    canActivate: [authGuard, permissionGuard('roles')]
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard, permissionGuard('settings')]
  },
  {
    path: 'subscription',
    loadComponent: () => import('./pages/subscription/subscription.component').then(m => m.SubscriptionComponent),
    canActivate: [authGuard, permissionGuard('settings')]
  },
  {
    path: 'batches',
    loadComponent: () => import('./pages/batches/batches.component').then(m => m.BatchesComponent),
    canActivate: [authGuard, permissionGuard('batches')]
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./pages/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
