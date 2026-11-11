import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse): Observable<never> => {
      if (error.status === 401 && !req.url.endsWith('/auth/login')) auth.logout();
      if (error.status === 403) void router.navigateByUrl('/');
      return throwError(() => error);
    }),
  );
};
