/**
 * Catalogue des délégations (plan « PR56 : critique et plan de correction », lot 7 ;
 * demande d'Emmanuel du 27/11 16h43 : « tous les diocèses de France, une délégation de
 * Luxembourg, et 2-3 de Belgique, plus une sans délégation »).
 *
 * Noms vérifiés le 27/11/2026 sur la liste officielle de la Conférence des évêques de
 * France : https://eglise.catholique.fr/guide-eglise-catholique-france/eveques-dioceses-france/liste-des-dioceses/
 * (93 diocèses de métropole + diocèses et collectivités d'outre-mer ; les noms longs
 * historiques — « Nancy et Toul », « Sens et Auxerre », « Périgueux et Sarlat »… — ne
 * sont plus les noms officiels affichés ; trois anciens diocèses supprimés — Noyon et
 * Senlis, Laon et Saint-Quentin, Dol et Saint-Malo — n'ont pas cours).
 * Belgique : 8 diocèses territoriaux dont 4 francophones (sources : la-croix.com,
 * cathobel.be, sept. 2024). Luxembourg : archidiocèse unique.
 */

export type DelegationZone =
  | 'metropole'
  | 'outre-mer'
  | 'luxembourg'
  | 'belgique'
  | 'institutionnel';

export interface DelegationCatalogEntry {
  /** Nom officiel court de la circonscription, tel que la CEF l'affiche. */
  diocese: string;
  /** Nom de la délégation dans l'intranet : « Délégation de Lyon ». */
  name: string;
  zone: DelegationZone;
  country: 'FR' | 'LU' | 'BE';
}

const entry = (
  diocese: string,
  zone: DelegationZone,
  country: 'FR' | 'LU' | 'BE' = 'FR',
): DelegationCatalogEntry => ({ diocese, name: `Délégation de ${diocese}`, zone, country });

/** 93 diocèses de métropole, liste CEF du 27/11/2026. */
export const DIOCESES_METROPOLE: DelegationCatalogEntry[] = [
  'Agen', 'Aire et Dax', 'Aix', 'Ajaccio', 'Albi', 'Amiens', 'Angers', 'Angoulême',
  'Annecy', 'Arras', 'Auch', 'Autun', 'Avignon', 'Bayeux-Lisieux', 'Bayonne',
  'Beauvais', 'Belfort-Montbéliard', 'Belley-Ars', 'Besançon', 'Blois', 'Bordeaux',
  'Bourges', 'Cahors', 'Cambrai', 'Carcassonne et Narbonne', 'Châlons',
  'Chambéry, Saint-Jean-de-Maurienne et Tarentaise', 'Chartres', 'Clermont',
  'Coutances', 'Créteil', 'Digne', 'Dijon', 'Évreux', 'Évry-Corbeil-Essonnes',
  'Fréjus-Toulon', 'Gap-Embrun', 'Grenoble-Vienne', 'La Rochelle', 'Langres', 'Laval',
  'Le Havre', 'Le Mans', 'Le Puy-en-Velay', 'Lille', 'Limoges', 'Luçon', 'Lyon',
  'Marseille', 'Meaux', 'Mende', 'Metz', 'Montauban', 'Montpellier', 'Moulins',
  'Nancy', 'Nanterre', 'Nantes', 'Nevers', 'Nice', 'Nîmes', 'Orléans', 'Pamiers',
  'Paris', 'Périgueux', 'Perpignan-Elne', 'Poitiers', 'Pontoise', 'Quimper', 'Reims',
  'Rennes', 'Rodez', 'Rouen', 'Saint-Brieuc', 'Saint-Claude', 'Saint-Denis',
  'Saint-Dié', 'Saint-Étienne', 'Saint-Flour', 'Séez', 'Sens', 'Soissons',
  'Strasbourg', 'Tarbes et Lourdes', 'Toulouse', 'Tours', 'Troyes', 'Tulle',
  'Valence', 'Vannes', 'Verdun', 'Versailles', 'Viviers',
].map((d) => entry(d, 'metropole'));

/** Outre-mer, libellés CEF du 27/11/2026 (diocèses puis collectivités). */
export const DIOCESES_OUTRE_MER: DelegationCatalogEntry[] = [
  'Basse-Terre', 'Cayenne', 'Fort-de-France', 'Saint-Denis-de-La Réunion',
  'Archipel des Comores (Mayotte)', 'Nouméa (Nouvelle-Calédonie)',
  'Papeete (Polynésie française)', 'Taiohae ou Tefenuaenata (Polynésie française)',
  'Wallis et Futuna',
].map((d) => entry(d, 'outre-mer'));

export const LUXEMBOURG: DelegationCatalogEntry[] = [
  entry('Luxembourg', 'luxembourg', 'LU'),
];

/**
 * Belgique : 3 diocèses francophones proposés (Tournai, Namur, Liège) — choix
 * remplaçable validé dans la revue ; Malines-Bruxelles est le 4e diocèse francophone
 * si Emmanuel préfère l'inclure. Les 4 néerlandophones (Anvers, Bruges, Gand,
 * Hasselt) s'ajoutent sans changer le modèle.
 */
export const BELGIQUE_PROPOSEES: DelegationCatalogEntry[] = [
  entry('Tournai', 'belgique', 'BE'),
  entry('Namur', 'belgique', 'BE'),
  entry('Liège', 'belgique', 'BE'),
];

/** Délégation spéciale : staff national et personnes non rattachées (coordinateurs). */
export const SANS_DELEGATION = {
  diocese: null as string | null,
  name: 'Sans délégation',
};

/**
 * Circonscriptions institutionnelles (hors diocèses territoriaux), statut vérifié
 * sur la liste CEF du 27/11/2026. Inclusion décidée par Emmanuel le 27/11 à 17h28
 * (« Oui ajoute les. », en réponse à la question de 17h19 sur le diocèse aux
 * Armées, la Mission de France et les Églises catholiques orientales).
 */
export const CIRCONSCRIPTIONS_INSTITUTIONNELLES: DelegationCatalogEntry[] = [
  {
    diocese: 'Diocèse aux Armées françaises',
    name: 'Délégation aux Armées françaises',
    zone: 'institutionnel',
    country: 'FR',
  },
  {
    diocese: 'Prélature de la Mission de France',
    name: 'Délégation de la Mission de France',
    zone: 'institutionnel',
    country: 'FR',
  },
  {
    diocese: 'Éparchie de Sainte-Croix de Paris des Arméniens catholiques de France',
    name: 'Délégation de Sainte-Croix de Paris (arménienne)',
    zone: 'institutionnel',
    country: 'FR',
  },
  {
    diocese: 'Éparchie de Notre-Dame-du-Liban de Paris des Maronites de France',
    name: 'Délégation de Notre-Dame-du-Liban de Paris (maronite)',
    zone: 'institutionnel',
    country: 'FR',
  },
  {
    diocese: 'Éparchie de Saint-Vladimir-le-Grand pour les Ukrainiens de rite byzantin de France',
    name: 'Délégation de Saint-Vladimir-le-Grand (ukrainienne)',
    zone: 'institutionnel',
    country: 'FR',
  },
  {
    diocese: 'Ordinariat des catholiques des Églises orientales en France',
    name: 'Délégation des catholiques des Églises orientales',
    zone: 'institutionnel',
    country: 'FR',
  },
];

export const CATALOGUE_DELEGATIONS: DelegationCatalogEntry[] = [
  ...DIOCESES_METROPOLE,
  ...DIOCESES_OUTRE_MER,
  ...LUXEMBOURG,
  ...BELGIQUE_PROPOSEES,
  ...CIRCONSCRIPTIONS_INSTITUTIONNELLES,
];

/**
 * La dizaine de délégations bien remplies du seed de démonstration (plan lot 7 :
 * « une dizaine de délégations bien remplies (celles de la maquette en tête) »).
 * Les cinq premières portent les effectifs cibles de la maquette ; les cinq
 * suivantes complètent la dizaine avec des effectifs variés.
 */
export const DELEGATIONS_VEDETTES: { diocese: string; effectifCible: number }[] = [
  { diocese: 'Lyon', effectifCible: 86 },
  { diocese: 'Annecy', effectifCible: 54 },
  { diocese: 'Valence', effectifCible: 31 },
  { diocese: 'Saint-Étienne', effectifCible: 58 },
  { diocese: 'Grenoble-Vienne', effectifCible: 63 },
  { diocese: 'Chambéry, Saint-Jean-de-Maurienne et Tarentaise', effectifCible: 40 },
  { diocese: 'Belley-Ars', effectifCible: 28 },
  { diocese: 'Clermont', effectifCible: 36 },
  { diocese: 'Marseille', effectifCible: 45 },
  { diocese: 'Paris', effectifCible: 70 },
];
