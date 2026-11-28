import type { ExpectedGroupsPage } from './features/access-reporting/expected-groups.page';
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
    title: 'Accès refusé',
    loadComponent: () => import('./shared/status-pages').then((m) => m.UnauthorizedPage),
  },
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'accueil' },
      { path: 'inscriptions-familles', title: 'Inscriptions des familles', canActivate:[roleGuard],data:{roles:['ADMIN','COORDINATOR']},loadComponent:()=>import('./features/family-registrations/family-registrations').then(m=>m.FamilyRegistrationsPage)},
      {path:'dossiers-sanitaires',title:'Dossiers sanitaires',canActivate:[roleGuard],data:{roles:['HEALTH']},loadComponent:()=>import('./features/family-registrations/family-health-staff').then(m=>m.FamilyHealthStaffPage)},
      { path: 'restauration-besoins',title:'Restauration : besoins',canActivate:[roleGuard],data:{roles:['CATERING']},loadComponent:()=>import('./features/family-registrations/catering-needs').then(m=>m.CateringNeedsPage)},
      {
        path: 'accueil',
        title: 'Accueil',
        loadComponent: () => import('./pages/accueil').then((m) => m.Accueil),
      },
      {
        path: 'glossaire',
        title: 'Glossaire',
        loadComponent: () => import('./features/glossaire/glossaire').then((m) => m.GlossairePage),
      },
      {
        path: 'rassemblement',
        title: 'Délégations',
        loadComponent: () =>
          import('./features/delegations/list/delegations-list.page').then(
            (m) => m.DelegationsListPage,
          ),
      },
      {
        path: 'groupes-rassemblement',
        title: 'Groupes de rassemblement',
        loadComponent: () =>
          import('./features/gathering-groups/gathering-groups.page').then(
            (m) => m.GatheringGroupsPage,
          ),
      },
      {
        path: 'groupes-rassemblement/repartitions/:id',
        title: 'Dispatch des équipes',
        loadComponent: () =>
          import('./features/gathering-groups/gathering-dispatch.page').then(
            (m) => m.GatheringDispatchPage,
          ),
      },
      {
        path: 'groupes-rassemblement/groupes/:id',
        title: 'Fiche groupe de rassemblement',
        loadComponent: () =>
          import('./features/gathering-groups/gathering-fiche.page').then(
            (m) => m.GatheringFichePage,
          ),
      },
      {
        path: 'participants',
        title: 'Participants',
        loadComponent: () =>
          import('./features/participants/participants').then((m) => m.ParticipantsPage),
      },
      {
        path: 'benevoles/repartition',
        title: 'Répartition bénévoles',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'COORDINATOR', 'LOGISTICS', 'VOLUNTEERS'] },
        loadComponent: () =>
          import('./features/benevoles-repartition/benevoles-repartition').then(
            (m) => m.BenevolesRepartitionPage,
          ),
      },
      {
        path: 'benevoles',
        title: 'Bénévoles',
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
        title: 'Équipes de rassemblement',
        loadComponent: () => import('./features/teams/teams').then((m) => m.TeamsPage),
      },
      {
        path: 'equipes/repartition',
        title: 'Répartition des jeunes',
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
      {
        path: 'acces/impression',
        title: 'Badges et impression',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-control/badge-print.page').then((m) => m.BadgePrintPage),
      },
      {
        path: 'acces/badges',
        title: 'Stock des badges',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-control/badges-stock.page').then((m) => m.BadgesStockPage),
      },
      {
        path: 'acces/attribution',
        title: 'Attribution et remplacement',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-control/badge-replace.page').then((m) => m.BadgeReplacePage),
      },
      {
        path: 'acces/habilitations',
        title: 'Autorisations de scan',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-control/scanner-grants.page').then((m) => m.ScannerGrantsPage),
      },
      {
        path: 'acces/configuration',
        title: 'Configuration du contrôle d\'accès',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-control/scan-config.page').then((m) => m.ScanConfigPage),
      },
      {
        path: 'acces/journal',
        title: 'Journal des accès',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-control/access-audit.page').then((m) => m.AccessAuditPage),
      },
      {
        path: 'lieux',
        title: 'Lieux',
        loadComponent: () => import('./features/places/places-page').then((m) => m.PlacesPageComponent),
      },
      {
        path: 'hebergement/carte',
        title: 'Hébergement : carte',
        loadComponent: () =>
          import('./features/assignments/host-families-map-page').then(
            (m) => m.HostFamiliesMapPageComponent,
          ),
      },
      {
        path: 'hebergement/placement',
        title: 'Hébergement : placement',
        loadComponent: () =>
          import('./features/hosting-placement/hosting-placement').then(
            (m) => m.HostingPlacementPage,
          ),
      },
      {
        path: 'hebergement',
        title: 'Hébergement',
        loadComponent: () =>
          import('./features/assignments/assignments').then((m) => m.AssignmentsPage),
      },
      {
        path: 'transports',
        title: 'Transports',
        loadComponent: () => import('./pages/transports').then((m) => m.Transports),
      },
      {
        path: 'delegations/:id',
        loadComponent: () =>
          import('./features/delegations/fiche/delegation-fiche.page').then(
            (m) => m.DelegationFichePage,
          ),
        title: 'Délégation',
      },
      {
        path: 'delegations/:id/transports',
        title: 'Transports de la délégation',
        loadComponent: () =>
          import('./features/delegations/delegation-detail').then((m) => m.DelegationDetailPage),
      },
      {
        path: 'suivi-notes',
        title: 'Notes sur les participants',
        loadComponent: () =>
          import('./features/delegations/person-notes').then((m) => m.PersonNotesPage),
      },
      {
        path: 'person-notes/:personType/:personId',
        title: 'Notes de la personne',
        loadComponent: () =>
          import('./features/delegations/person-notes').then((m) => m.PersonNotesPage),
      },
      {
        path: 'programme',
        canDeactivate: [
          (component: { canDeactivate: () => boolean | Promise<boolean> }) =>
            component.canDeactivate(),
        ],
        title: 'Agenda et ordonnancement',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'COORDINATOR', 'HEALTH', 'ANIMATOR', 'LOGISTICS', 'VIEWER'] },
        loadComponent: () => import('./features/programme/programme').then((m) => m.ProgrammePage),
      },
      {
        path: 'programme/journal',
        title: 'Journal des modifications',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'COORDINATOR', 'HEALTH', 'ANIMATOR', 'LOGISTICS', 'VIEWER'] },
        loadComponent: () =>
          import('./features/programme/journal/programme-journal').then(
            (m) => m.ProgrammeJournalPage,
          ),
      },
      {
        path: 'programme/evenements/:id',
        title: 'Fiche événement',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'COORDINATOR', 'HEALTH', 'ANIMATOR', 'LOGISTICS', 'VIEWER'] },
        loadComponent: () =>
          import('./features/programme/fiche-evenement/fiche-evenement').then(
            (m) => m.FicheEvenementPage,
          ),
      },
      {
        path: 'jour-j',
        title: 'Tableau de bord Jour J',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'COORDINATOR', 'HEALTH', 'ANIMATOR', 'LOGISTICS', 'VIEWER'] },
        loadComponent: () => import('./pages/jour-j').then((m) => m.JourJ),
      },
      {
        path: 'acces/groupes',
        title: 'Groupes attendus',
        canActivate: [roleGuard],
        canDeactivate: [(component: ExpectedGroupsPage) => component.canDeactivate()],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-reporting/expected-groups.page').then(
            (m) => m.ExpectedGroupsPage,
          ),
      },
      {
        path: 'acces/historique-groupe',
        title: 'Historique d\'un groupe',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-reporting/group-history.page').then((m) => m.GroupHistoryPage),
      },
      {
        path: 'acces/historique-personne',
        title: 'Historique d\'une personne',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-reporting/person-history.page').then(
            (m) => m.PersonHistoryPage,
          ),
      },
      {
        path: 'acces/dashboard',
        title: 'Tableau de bord des accès',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-reporting/detail-report.page').then((m) => m.DetailReportPage),
      },
      {
        path: 'acces/scannes',
        title: 'Scannés par lieu',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'], mode: 'place' },
        loadComponent: () =>
          import('./features/access-reporting/detail-report.page').then((m) => m.DetailReportPage),
      },
      {
        path: 'acces/non-scannes',
        title: 'Non scannés · groupes attendus',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'], mode: 'missing' },
        loadComponent: () =>
          import('./features/access-reporting/expected-report.page').then(
            (m) => m.ExpectedReportPage,
          ),
      },
      {
        path: 'acces/groupes-exceptions',
        title: 'Groupes attendus · exceptions',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'], mode: 'groups' },
        loadComponent: () =>
          import('./features/access-reporting/expected-report.page').then(
            (m) => m.ExpectedReportPage,
          ),
      },
      {
        path: 'acces/suivi',
        title: 'Suivi des accès',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'BADGE_MANAGER'] },
        loadComponent: () =>
          import('./features/access-reporting/access-reporting.page').then(
            (m) => m.AccessReportingPage,
          ),
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
        title: 'Incidents et demandes',
        loadComponent: () => import('./pages/incidents').then((m) => m.Incidents),
      },
      {
        path: 'consignes-docs',
        title: 'Consignes & documents',
        loadComponent: () =>
          import('./features/consignes-docs/consignes-docs-catalog').then(
            (m) => m.ConsignesDocsCatalogPage,
          ),
      },
      {
        path: 'consignes-docs/gestion',
        title: 'Gestion du catalogue',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'COORDINATOR'] },
        loadComponent: () =>
          import('./features/consignes-docs/consignes-docs-manage').then(
            (m) => m.ConsignesDocsManagePage,
          ),
      },
      {
        path: 'parametres-roles',
        title: 'Paramètres et rôles',
        loadComponent: () => import('./pages/parametres-roles').then((m) => m.ParametresRoles),
      },
      {
        path: 'donnees-exports',
        title: 'Données et exports',
        loadComponent: () => import('./pages/donnees-exports').then((m) => m.DonneesExports),
      },
    ],
  },
  { path: '**', redirectTo: 'accueil' },
];
