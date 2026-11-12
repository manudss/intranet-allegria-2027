import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const appRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login').then((m) => m.LoginComponent),
    title: 'Connexion - ALEGRIA',
  },
  {
    path: 'public',
    loadComponent: () =>
      import('./features/public/public-shell/public-shell.component').then(
        (m) => m.PublicShellComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/public/public-home/public-home').then((m) => m.PublicHomeComponent),
        title: 'Bienvenue - ALEGRIA',
      },
      {
        path: 'programme',
        loadComponent: () =>
          import('./features/public/public-program/public-program').then(
            (m) => m.PublicProgramComponent,
          ),
        title: 'Programme - ALEGRIA',
      },
      {
        path: 'infos',
        loadComponent: () =>
          import('./features/public/public-infos/public-infos').then((m) => m.PublicInfosComponent),
        title: 'Infos pratiques - ALEGRIA',
      },
    ],
  },
  {
    path: '',
    loadComponent: () =>
      import('./shared/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/home/home').then((m) => m.HomeComponent),
        title: 'Accueil - ALEGRIA',
      },
      {
        path: 'espace',
        loadComponent: () =>
          import('./features/my-space/my-space').then((m) => m.MySpaceComponent),
        title: 'Mon espace - ALEGRIA',
      },
      {
        path: 'programme',
        loadComponent: () =>
          import('./features/program/program').then((m) => m.ProgramComponent),
        title: 'Programme - ALEGRIA',
      },
      {
        path: 'infos',
        loadComponent: () =>
          import('./features/infos/infos-page').then((m) => m.InfosPageComponent),
        title: 'Infos pratiques - ALEGRIA',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
