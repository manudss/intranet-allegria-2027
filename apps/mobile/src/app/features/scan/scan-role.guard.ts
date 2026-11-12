import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
export const scanRoleGuard: CanActivateChildFn = (route) => {
  const auth = inject(AuthService);
  const roles = route.routeConfig?.path === 'attribuer' ? ['ADMIN', 'BADGE_MANAGER'] : ['ADMIN', 'SCANNER', 'BADGE_MANAGER'];
  return auth.hasAnyRole(roles) || inject(Router).createUrlTree(['/']);
};
