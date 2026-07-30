import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { authInterceptor } from './core/auth.interceptor';
import { httpErrorInterceptor } from './core/http-error.interceptor';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([authInterceptor, httpErrorInterceptor])),
    provideTaiga(),
  ],
};
