import { AppearanceService } from '@mej-allegria/appearance';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTaiga, TUI_DARK_MODE } from '@taiga-ui/core';
import { apiBaseUrlInterceptor } from './core/api-base-url.interceptor';
import { authInterceptor } from './core/auth.interceptor';
import { httpErrorInterceptor } from './core/http-error.interceptor';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(appRoutes),
    provideHttpClient(
      withInterceptors([apiBaseUrlInterceptor, authInterceptor, httpErrorInterceptor]),
    ),
    provideTaiga(),
    {
      provide: TUI_DARK_MODE,
      useFactory: () => inject(AppearanceService).dark,
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
