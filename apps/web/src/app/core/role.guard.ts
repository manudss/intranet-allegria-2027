import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = (route.data?.['roles'] as string[] | undefined) ?? [];
  return auth
    .restoreSession()
    .pipe(map((ok) => (ok && auth.hasAnyRole(roles)) || router.createUrlTree(['/unauthorized'])));
};
