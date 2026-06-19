import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ShopConfigService } from '../services/shop-config.service';
import { AppResource } from '../models';

/**
 * Redirects to /setup if the shop hasn't been configured yet.
 */
export const setupGuard: CanActivateFn = () => {
  const config = inject(ShopConfigService);
  const router = inject(Router);

  if (config.isConfigured) {
    return true;
  }
  router.navigate(['/setup']);
  return false;
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
    router.navigate(['/setup']);
    return false;
  }

  await auth.ensureSessionLoaded();

  if (auth.isLoggedIn) {
    return true;
  }
  router.navigate(['/login']);
  return false;
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
      router.navigate(['/login']);
      return false;
    }

    if (auth.canView(resource)) {
      return true;
    }

    // No permission → back to dashboard
    router.navigate(['/dashboard']);
    return false;
  };
}
