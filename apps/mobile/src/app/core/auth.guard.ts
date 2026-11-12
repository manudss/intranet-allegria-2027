import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';
export const authGuard: CanActivateFn = (_, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth
    .restoreSession()
    .pipe(
      map(
        (ok) => ok || router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }),
      ),
    );
};
