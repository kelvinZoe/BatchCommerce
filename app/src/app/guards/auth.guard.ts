import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ShopConfigService } from '../services/shop-config.service';
import { AppResource } from '../models';
import { BillingDataService } from '../services/billing-data.service';

/**
 * Redirects to /setup if the shop hasn't been configured yet.
 */
export const setupGuard: CanActivateFn = () => {
  const config = inject(ShopConfigService);
  const router = inject(Router);

  if (config.isConfigured) {
    return true;
  }
  return router.createUrlTree(['/setup']);
};

/**
 * Checks that the user is logged in.
 * Use on all routes except /login and /setup.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const config = inject(ShopConfigService);

  if (!config.isConfigured) {
    return router.createUrlTree(['/setup']);
  }

  await auth.ensureSessionLoaded();

  if (auth.isLoggedIn) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

/**
 * Factory that returns a guard checking `canView` on a specific resource.
 *
 * Usage in routes:
 *   canActivate: [authGuard, permissionGuard('products')]
 */
export function permissionGuard(resource: AppResource): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.ensureSessionLoaded();

    if (!auth.isLoggedIn) {
      return router.createUrlTree(['/login']);
    }

    if (auth.canView(resource)) {
      return true;
    }

    // Never redirect a denied dashboard back to itself. Send the user to the
    // first page their role can view, or show a stable no-access screen when
    // the role has not been granted any page permissions yet.
    return router.createUrlTree([auth.getDefaultAuthenticatedRoute()]);
  };
}

export const platformAdminGuard: CanActivateFn = async () => {
  const billing = inject(BillingDataService);
  const auth = inject(AuthService);
  const router = inject(Router);
  if (await billing.isPlatformAdmin()) return true;
  return router.createUrlTree([auth.getDefaultAuthenticatedRoute()]);
};
