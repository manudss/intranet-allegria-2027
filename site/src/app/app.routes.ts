import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Accueil',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'evenement',
    title: 'L’événement',
    loadComponent: () => import('./features/event/event').then((m) => m.EventPage),
  },
  {
    path: 'programme',
    title: 'Programme',
    loadComponent: () => import('./features/programme/programme').then((m) => m.Programme),
  },
  {
    path: 'participer',
    title: 'Participer',
    loadComponent: () => import('./features/participer/participer').then((m) => m.Participer),
  },
  {
    path: 'inscription/jeunes',
    title: 'Inscription des jeunes',
    loadComponent: () =>
      import('./features/inscription-jeunes/inscription-jeunes').then((m) => m.InscriptionJeunes),
  },
  {
    path: 'inscription/familles',
    title: 'Inscription des familles',
    loadComponent: () =>
      import('./features/inscription-familles/inscription-familles').then(
        (m) => m.InscriptionFamilles,
      ),
  },
  {
    path: 'benevoles',
    title: 'Bénévoles',
    loadComponent: () => import('./features/benevoles/benevoles').then((m) => m.Benevoles),
  },
  {
    path: 'inscription/benevoles',
    title: 'Inscription des bénévoles',
    loadComponent: () =>
      import('./features/inscription-benevoles/inscription-benevoles').then(
        (m) => m.InscriptionBenevoles,
      ),
  },
  {
    path: 'faq',
    title: 'FAQ',
    loadComponent: () => import('./features/faq/faq').then((m) => m.Faq),
  },
  {
    path: 'lieu',
    title: 'Lieu et accès',
    loadComponent: () => import('./features/lieu/lieu').then((m) => m.Lieu),
  },
  {
    path: 'contact',
    title: 'Contact',
    loadComponent: () => import('./features/contact/contact').then((m) => m.Contact),
  },
  {
    path: 'mentions-legales',
    title: 'Mentions légales',
    loadComponent: () => import('./features/legal/mentions-legales').then((m) => m.MentionsLegales),
  },
  {
    path: 'politique-confidentialite',
    title: 'Politique de confidentialité',
    loadComponent: () =>
      import('./features/legal/politique-confidentialite').then((m) => m.PolitiqueConfidentialite),
  },
  {
    path: 'accessibilite',
    title: 'Accessibilité',
    loadComponent: () => import('./features/legal/accessibilite').then((m) => m.Accessibilite),
  },
  { path: '**', redirectTo: '' },
];
