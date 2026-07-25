import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'accueil' },
  {
    path: 'accueil',
    title: 'Accueil',
    loadComponent: () => import('./pages/accueil').then((m) => m.Accueil),
  },
  {
    path: 'rassemblement',
    title: 'Rassemblement',
    loadComponent: () => import('./pages/rassemblement').then((m) => m.Rassemblement),
  },
  {
    path: 'participants',
    title: 'Participants',
    loadComponent: () => import('./pages/participants').then((m) => m.Participants),
  },
  {
    path: 'benevoles',
    title: 'Benevoles',
    loadComponent: () => import('./pages/benevoles').then((m) => m.Benevoles),
  },
  {
    path: 'familles',
    title: "Familles d'accueil",
    loadComponent: () => import('./pages/familles').then((m) => m.Familles),
  },
  {
    path: 'equipes-missions',
    title: 'Equipes & missions',
    loadComponent: () => import('./pages/equipes-missions').then((m) => m.EquipesMissions),
  },
  {
    path: 'transports',
    title: 'Transports',
    loadComponent: () => import('./pages/transports').then((m) => m.Transports),
  },
  {
    path: 'hebergement',
    title: 'Hebergement',
    loadComponent: () => import('./pages/hebergement').then((m) => m.Hebergement),
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
    loadComponent: () => import('./pages/parametres-roles').then((m) => m.ParametresRoles),
  },
  {
    path: 'donnees-exports',
    title: 'Donnees & exports',
    loadComponent: () => import('./pages/donnees-exports').then((m) => m.DonneesExports),
  },
  { path: '**', redirectTo: 'accueil' },
];
