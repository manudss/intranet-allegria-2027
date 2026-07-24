import { Route } from '@angular/router';
import { Accueil } from './pages/accueil';
import { Benevoles } from './pages/benevoles';
import { ConsignesDocs } from './pages/consignes-docs';
import { DonneesExports } from './pages/donnees-exports';
import { EquipesMissions } from './pages/equipes-missions';
import { Familles } from './pages/familles';
import { Hebergement } from './pages/hebergement';
import { Incidents } from './pages/incidents';
import { JourJ } from './pages/jour-j';
import { ParametresRoles } from './pages/parametres-roles';
import { Participants } from './pages/participants';
import { Rassemblement } from './pages/rassemblement';
import { Transports } from './pages/transports';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'accueil' },
  { path: 'accueil', component: Accueil },
  { path: 'rassemblement', component: Rassemblement },
  { path: 'participants', component: Participants },
  { path: 'benevoles', component: Benevoles },
  { path: 'familles', component: Familles },
  { path: 'equipes-missions', component: EquipesMissions },
  { path: 'transports', component: Transports },
  { path: 'hebergement', component: Hebergement },
  { path: 'jour-j', component: JourJ },
  { path: 'incidents', component: Incidents },
  { path: 'consignes-docs', component: ConsignesDocs },
  { path: 'parametres-roles', component: ParametresRoles },
  { path: 'donnees-exports', component: DonneesExports },
  { path: '**', redirectTo: 'accueil' },
];
