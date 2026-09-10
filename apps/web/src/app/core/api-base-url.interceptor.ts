import { HttpInterceptorFn } from '@angular/common/http';
import { apiUrl } from './runtime-config';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.url.startsWith('/api') ? req.clone({ url: apiUrl(req.url) }) : req);

