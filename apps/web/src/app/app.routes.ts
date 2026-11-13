import { Route } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { roleGuard } from './core/role.guard';
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
        path: 'benevoles/repartition',
        title: 'Repartition benevoles',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'COORDINATOR', 'LOGISTICS', 'VOLUNTEERS'] },
        loadComponent: () =>
          import('./features/benevoles-repartition/benevoles-repartition').then(
            (m) => m.BenevolesRepartitionPage,
          ),
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
        path: 'equipes',
        title: 'Equipes de rassemblement',
        loadComponent: () => import('./features/teams/teams').then((m) => m.TeamsPage),
      },
      {
        path: 'equipes/repartition',
        title: 'Repartition jeunes en equipes',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'COORDINATOR', 'ANIMATOR', 'LOGISTICS', 'VIEWER'] },
        loadComponent: () =>
          import('./features/jeunes-repartition/jeunes-repartition').then(
            (m) => m.JeunesRepartitionPage,
          ),
      },
      {
        path: 'equipes-operationnelles',
        title: 'Équipes opérationnelles',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'COORDINATOR', 'HEALTH', 'VOLUNTEERS', 'LOGISTICS', 'VIEWER'] },
        loadComponent: () =>
          import('./features/volunteer-teams/volunteer-teams').then((m) => m.VolunteerTeamsPage),
      },
      {
        path: 'missions-benevoles',
        title: 'Missions bénévoles',
        canActivate: [roleGuard],
        data: {
          roles: [
            'ADMIN',
            'COORDINATOR',
            'HEALTH',
            'ANIMATOR',
            'VOLUNTEERS',
            'LOGISTICS',
            'VIEWER',
          ],
        },
        loadComponent: () =>
          import('./features/volunteer-missions/volunteer-missions').then(
            (m) => m.VolunteerMissionsPage,
          ),
      },
      {
        path: 'journal-benevoles',
        title: 'Journal bénévoles',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'COORDINATOR'] },
        loadComponent: () =>
          import('./features/volunteer-audit-logs/volunteer-audit-logs').then(
            (m) => m.VolunteerAuditLogsPage,
          ),
      },
      {path:'acces/impression',title:'Badges et impression',canActivate:[roleGuard],data:{roles:['ADMIN','BADGE_MANAGER']},loadComponent:()=>import('./features/access-control/badge-print.page').then(m=>m.BadgePrintPage)},
      {
        path: 'acces/badges',
        title: 'Stock badges',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-control/badges-stock.page').then((m) => m.BadgesStockPage),
      },
      {
        path: 'acces/attribution',
        title: 'Attribution badges',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-control/badge-replace.page').then((m) => m.BadgeReplacePage),
      },
      {
        path: 'acces/habilitations',
        title: 'Habilitations scan',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-control/scanner-grants.page').then((m) => m.ScannerGrantsPage),
      },
      {
        path: 'acces/configuration',
        title: "Configuration acces",
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-control/scan-config.page').then((m) => m.ScanConfigPage),
      },
      {
        path: 'acces/journal',
        title: "Journal acces",
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-control/access-audit.page').then((m) => m.AccessAuditPage),
      },
      {
        path: 'hebergement/carte',
        title: 'Hebergement - Carte',
        loadComponent: () =>
          import('./features/assignments/host-families-map-page').then(
            (m) => m.HostFamiliesMapPageComponent,
          ),
      },
      {
        path: 'hebergement/placement',
        title: 'Hebergement - Placement',
        loadComponent: () =>
          import('./features/hosting-placement/hosting-placement').then(
            (m) => m.HostingPlacementPage,
          ),
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
        path: 'programme',
        title: 'Planning & Ordonnancement',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'COORDINATOR', 'HEALTH', 'ANIMATOR', 'LOGISTICS', 'VIEWER'] },
        loadComponent: () => import('./features/programme/programme').then((m) => m.ProgrammePage),
      },
      {
        path: 'jour-j',
        title: 'Tableau de bord Jour J',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'COORDINATOR', 'HEALTH', 'ANIMATOR', 'LOGISTICS', 'VIEWER'] },
        loadComponent: () => import('./pages/jour-j').then((m) => m.JourJ),
      },
      {path:'acces/non-scannes',title:'Non scannés · groupes attendus',canActivate:[roleGuard],data:{roles:['ADMIN','BADGE_MANAGER'],mode:'missing'},loadComponent:()=>import('./features/access-reporting/expected-report.page').then(m=>m.ExpectedReportPage)},
      {path:'acces/groupes-exceptions',title:'Groupes attendus · exceptions',canActivate:[roleGuard],data:{roles:['ADMIN','BADGE_MANAGER'],mode:'groups'},loadComponent:()=>import('./features/access-reporting/expected-report.page').then(m=>m.ExpectedReportPage)},
      {
        path: 'acces/suivi',
        title: 'Suivi des accès',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () => import('./features/access-reporting/access-reporting.page').then(m => m.AccessReportingPage),
      },
      {
        path: 'suivi-operationnel',
        title: 'Suivi opérationnel',
        canActivate: [roleGuard],
        data: {
          roles: [
            'ADMIN',
            'COORDINATOR',
            'HEALTH',
            'ANIMATOR',
            'VOLUNTEERS',
            'LOGISTICS',
            'VIEWER',
          ],
        },
        loadComponent: () =>
          import('./features/volunteer-missions/shifts-summary').then((m) => m.ShiftsSummaryPage),
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
    ],
  },
  { path: '**', redirectTo: 'accueil' },
];
