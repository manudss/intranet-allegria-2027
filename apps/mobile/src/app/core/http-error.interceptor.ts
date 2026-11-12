import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { TuiAlertService } from '@taiga-ui/core';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const alerts = inject(TuiAlertService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse): Observable<never> => {
      if (error.status === 401 && !req.url.endsWith('/auth/login')) auth.logout();
      if (error.status === 403) {
        // Avant : retour silencieux a l'accueil. Maintenant : la raison est visible.
        alerts
          .open("Ton compte n'a pas accès à cette section. Contacte la coordination si c'est une erreur.", {
            label: 'Accès refusé',
            appearance: 'negative',
          })
          .subscribe();
        void router.navigateByUrl('/');
      }
      return throwError(() => error);
    }),
  );
};
