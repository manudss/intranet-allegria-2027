import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { Layout } from './layout';

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.module').then((m) => m.AuthModule),
  },
  {
    path: 'unauthorized',
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
        loadChildren: () => import('./features/groups/groups.module').then((m) => m.GroupsModule),
      },
      {
        path: 'participants',
        title: 'Participants',
        loadChildren: () =>
          import('./features/participants/participants.module').then((m) => m.ParticipantsModule),
      },
      {
        path: 'benevoles',
        title: 'Bénévoles',
        loadChildren: () =>
          import('./features/volunteers/volunteers.module').then((m) => m.VolunteersModule),
      },
      {
        path: 'familles',
        title: "Familles d'accueil",
        loadChildren: () =>
          import('./features/host-families/host-families.module').then((m) => m.HostFamiliesModule),
      },
      {
        path: 'equipes-missions',
        title: 'Équipes & missions',
        loadChildren: () => import('./features/teams/teams.module').then((m) => m.TeamsModule),
      },
      {
        path: 'hebergement',
        title: 'Hébergement',
        loadChildren: () =>
          import('./features/assignments/assignments.module').then((m) => m.AssignmentsModule),
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
        title: 'Paramètres & rôles',
        loadComponent: () => import('./pages/parametres-roles').then((m) => m.ParametresRoles),
      },
      {
        path: 'donnees-exports',
        title: 'Données & exports',
        loadComponent: () => import('./pages/donnees-exports').then((m) => m.DonneesExports),
      },
    ],
  },
  { path: '**', redirectTo: 'accueil' },
];

@NgModule({ imports: [RouterModule.forRoot(routes)], exports: [RouterModule] })
export class AppRoutingModule {}
