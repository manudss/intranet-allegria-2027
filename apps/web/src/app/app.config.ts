import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { provideRouter } from '@angular/router';
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
      // Thème clair uniquement : par défaut Taiga UI suit prefers-color-scheme
      // et basculait en palette sombre (texte blanc) sur les écrans clairs de
      // l'app — champs illisibles sur téléphone en thème sombre.
      provide: TUI_DARK_MODE,
      useFactory: () => Object.assign(signal(false), { reset: () => undefined }),
    },
  ],
};
