import { Route } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { Layout } from './layout';

export const appRoutes: Route[] = [
  {
    path: 'login',
    title: 'Connexion',
    loadComponent: () => import('./features/auth/login').then((m) => m.LoginComponent),
  },
  {
    path: 'unauthorized',
    title: 'Acces refuse',
    loadComponent: () => import('./shared/status-pages').then((m) => m.UnauthorizedPage),
  },
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'accueil' },
      {
        path: 'accueil',
        title: 'Accueil',
        loadComponent: () => import('./pages/accueil').then((m) => m.Accueil),
      },
      {
        path: 'rassemblement',
        title: 'Rassemblement',
        loadComponent: () => import('./features/groups/groups').then((m) => m.GroupsPage),
      },
      {
        path: 'participants',
        title: 'Participants',
        loadComponent: () =>
          import('./features/participants/participants').then((m) => m.ParticipantsPage),
      },
      {
        path: 'benevoles',
        title: 'Benevoles',
        loadComponent: () =>
          import('./features/volunteers/volunteers').then((m) => m.VolunteersPage),
      },
      {
        path: 'familles',
        title: "Familles d'accueil",
        loadComponent: () =>
          import('./features/host-families/host-families').then((m) => m.HostFamiliesPage),
      },
      {
        path: 'equipes-missions',
        title: 'Equipes & missions',
        loadComponent: () => import('./features/teams/teams').then((m) => m.TeamsPage),
      },
      {
        path: 'hebergement',
        title: 'Hebergement',
        loadComponent: () =>
          import('./features/assignments/assignments').then((m) => m.AssignmentsPage),
      },
      {
        path: 'transports',
        title: 'Transports',
        loadComponent: () => import('./pages/transports').then((m) => m.Transports),
      },
      {
        path: 'jour-j',
        title: 'Tableau de bord Jour J',
        loadComponent: () => import('./pages/jour-j').then((m) => m.JourJ),
      },
      {
        path: 'incidents',
        title: 'Incidents & demandes',
        loadComponent: () => import('./pages/incidents').then((m) => m.Incidents),
      },
      {
        path: 'consignes-docs',
        title: 'Consignes & documents',
        loadComponent: () => import('./pages/consignes-docs').then((m) => m.ConsignesDocs),
      },
      {
        path: 'parametres-roles',
        title: 'Parametres & roles',
        loadComponent: () =>
          import('./pages/parametres-roles').then((m) => m.ParametresRoles),
      },
      {
        path: 'donnees-exports',
        title: 'Donnees & exports',
        loadComponent: () => import('./pages/donnees-exports').then((m) => m.DonneesExports),
      },
    ],
  },
  { path: '**', redirectTo: 'accueil' },
];
