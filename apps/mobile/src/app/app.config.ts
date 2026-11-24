import { AppearanceService } from '@mej-allegria/appearance';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideRouter } from '@angular/router';
import { TUI_FRENCH_LANGUAGE } from '@taiga-ui/i18n/languages';
import { TUI_LANGUAGE } from '@taiga-ui/i18n';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTaiga, TUI_DARK_MODE } from '@taiga-ui/core';
import { apiBaseUrlInterceptor } from './core/api-base-url.interceptor';
import { authInterceptor } from './core/auth.interceptor';
import { httpErrorInterceptor } from './core/http-error.interceptor';
import { appRoutes } from './app.routes';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(appRoutes),
    provideHttpClient(
      withInterceptors([apiBaseUrlInterceptor, authInterceptor, httpErrorInterceptor]),
    ),
    { provide: LOCALE_ID, useValue: 'fr' },
    { provide: TUI_LANGUAGE, useValue: signal(TUI_FRENCH_LANGUAGE) },
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
