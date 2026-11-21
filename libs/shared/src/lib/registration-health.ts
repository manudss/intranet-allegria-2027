import type { SignatureAppearance, SignatureVerification } from './family-registration';
export const HEALTH_FORM_PAGES = [
  {
    title: 'Identité et personnes à joindre',
    fields: [
      ['birthPlace', 'Lieu de naissance'],
      ['addressType', 'Domicile parental, famille élargie ou autre'],
      ['guardian2', 'Autre représentant légal : nom, lien et téléphones'],
      ['emergency2', 'Autre personne à joindre : nom, lien et téléphones'],
      ['doctor', 'Médecin traitant : coordonnées utiles'],
    ],
  },
  {
    title: 'Santé utile au séjour',
    fields: [
      ['history', 'Problèmes importants pour le séjour et dates'],
      ['followUp', 'Suivi particulier utile à l’accueil'],
    ],
  },
  {
    title: 'Traitements et accompagnement',
    fields: [
      ['treatment', 'Traitement : quotidien, appoint ou crise, consignes prescrites'],
      ['prescription', 'Ordonnance récente : remise à organiser'],
      ['pai', 'PAI : document et échange confidentiel à organiser'],
    ],
  },
  {
    title: 'Allergies et repas',
    fields: [
      ['foodAllergy', 'Allergies alimentaires et conduite à tenir'],
      ['animalAllergy', 'Allergies aux animaux et conduite à tenir'],
      ['pollenAllergy', 'Allergies aux pollens/acariens et conduite à tenir'],
      ['drugAllergy', 'Allergies médicamenteuses et conduite à tenir'],
      ['asthma', 'Asthme et conduite à tenir'],
      ['diet', 'Besoins de repas, distincts des allergies'],
    ],
  },
  {
    title: 'Vaccinations et justificatif',
    fields: [
      ['vaccinations', 'Vaccinations et dates selon le justificatif'],
      ['vaccineDocument', 'Justificatif à remettre au référent santé'],
    ],
  },
  {
    title: 'Vie quotidienne et adaptations',
    fields: [
      ['communication', 'Communication et expression : aide utile'],
      ['sleep', 'Endormissement, réveils, cauchemars : aide utile'],
      ['mobility', 'Mobilité, fragilité osseuse/articulaire : adaptations'],
      ['sensory', 'Perception visuelle/auditive : adaptations'],
      [
        'learning',
        'Apprentissages, attention, troubles dys ou neurodéveloppement : accompagnement utile',
      ],
      ['mental', 'Accompagnement psychique, humeur, alimentation : besoins utiles'],
      ['swimming', 'Aisance aquatique et tests obtenus'],
      ['equipment', 'Dispositifs médicaux, lunettes, prothèses auditives/dentaires, semelles'],
      ['dailyLife', 'Continence, règles, saignements de nez : aide utile'],
      ['fears', 'Peurs et phobies : animaux, eau, noir, vertige, autres'],
      ['other', 'Autres informations utiles au séjour'],
    ],
  },
  { title: 'Relire la fiche et signer', fields: [] },
] as const;
/** Optional, verbatim model choices. Missing never means no; no diagnosis is inferred. */
export const HEALTH_MODEL_ITEMS = [
  {
    id: 'treatment',
    label: 'Prise de traitement médical',
    page: 2,
    answerKey: 'treatment',
    pdfPage: 0,
    y: 186,
    x: 92,
  },
  {
    id: 'foodAllergy',
    label: 'Allergies alimentaires',
    page: 3,
    answerKey: 'foodAllergy',
    pdfPage: 1,
    y: 644,
    x: 229,
  },
  {
    id: 'animalAllergy',
    label: 'Allergies aux animaux',
    page: 3,
    answerKey: 'animalAllergy',
    pdfPage: 1,
    y: 626,
    x: 229,
  },
  {
    id: 'pollenAllergy',
    label: 'Allergies aux pollens / acariens',
    page: 3,
    answerKey: 'pollenAllergy',
    pdfPage: 1,
    y: 608,
    x: 229,
  },
  {
    id: 'drugAllergy',
    label: 'Allergies médicamenteuses',
    page: 3,
    answerKey: 'drugAllergy',
    pdfPage: 1,
    y: 590,
    x: 229,
  },
  { id: 'asthma', label: 'Asthme', page: 3, answerKey: 'asthma', pdfPage: 1, y: 572, x: 229 },
  {
    id: 'communicate',
    label: 'Difficultés à communiquer',
    page: 5,
    answerKey: 'communication',
    pdfPage: 2,
    y: 739.1,
    x: 241.1,
  },
  {
    id: 'express',
    label: 'Difficultés à s’exprimer',
    page: 5,
    answerKey: 'communication',
    pdfPage: 2,
    y: 711.3,
    x: 241.1,
  },
  {
    id: 'fallAsleep',
    label: 'Endormissement / réveils nocturnes',
    page: 5,
    answerKey: 'sleep',
    pdfPage: 2,
    y: 684.3,
    x: 241.1,
  },
  {
    id: 'bone',
    label: 'Fragilité osseuse ou articulaire',
    page: 5,
    answerKey: 'mobility',
    pdfPage: 2,
    y: 656.5,
    x: 241.1,
  },
  {
    id: 'cognitive',
    label: 'Handicap cognitif',
    page: 5,
    answerKey: 'learning',
    pdfPage: 2,
    y: 628.8,
    x: 241.1,
  },
  {
    id: 'intellectual',
    label: 'Handicap mental ou déficience intellectuelle',
    page: 5,
    answerKey: 'learning',
    pdfPage: 2,
    y: 601,
    x: 241.1,
  },
  {
    id: 'motor',
    label: 'Handicap physique ou moteur',
    page: 5,
    answerKey: 'mobility',
    pdfPage: 2,
    y: 573.9,
    x: 241.1,
  },
  {
    id: 'sensory',
    label: 'Handicap sensoriel',
    page: 5,
    answerKey: 'sensory',
    pdfPage: 2,
    y: 546.2,
    x: 241.1,
  },
  {
    id: 'nightmares',
    label: 'Peur du noir / cauchemars fréquents',
    page: 5,
    answerKey: 'sleep',
    pdfPage: 2,
    y: 519.1,
    x: 241.1,
  },
  {
    id: 'multiple',
    label: 'Polyhandicap',
    page: 5,
    answerKey: 'other',
    pdfPage: 2,
    y: 491.4,
    x: 241.1,
  },
  {
    id: 'attention',
    label: 'Trouble de l’attention',
    page: 5,
    answerKey: 'learning',
    pdfPage: 2,
    y: 463.6,
    x: 241.1,
  },
  {
    id: 'mood',
    label: 'Trouble de l’humeur',
    page: 5,
    answerKey: 'mental',
    pdfPage: 2,
    y: 435.8,
    x: 241.1,
  },
  {
    id: 'eating',
    label: 'Trouble du comportement alimentaire',
    page: 5,
    answerKey: 'mental',
    pdfPage: 2,
    y: 408.8,
    x: 241.1,
  },
  {
    id: 'sleepDisorder',
    label: 'Trouble du sommeil',
    page: 5,
    answerKey: 'sleep',
    pdfPage: 2,
    y: 381.1,
    x: 241.1,
  },
  { id: 'dys', label: 'Trouble dys', page: 5, answerKey: 'learning', pdfPage: 2, y: 354, x: 241.1 },
  {
    id: 'neurodevelopment',
    label: 'Troubles neurodéveloppementaux (TSA, TDA/H)',
    page: 5,
    answerKey: 'learning',
    pdfPage: 2,
    y: 326.2,
    x: 241.1,
  },
  {
    id: 'neurological',
    label: 'Trouble neurologique',
    page: 5,
    answerKey: 'other',
    pdfPage: 2,
    y: 298.5,
    x: 241.1,
  },
  {
    id: 'swimming',
    label: 'Aisance aquatique',
    page: 5,
    answerKey: 'swimming',
    pdfPage: 2,
    y: 230.9,
    x: 204.2,
  },
  {
    id: 'devices',
    label: 'Autres dispositifs médicaux',
    page: 5,
    answerKey: 'equipment',
    pdfPage: 2,
    y: 203.2,
    x: 204.2,
  },
  {
    id: 'menstruation',
    label: 'Menstruations / règles',
    page: 5,
    answerKey: 'dailyLife',
    pdfPage: 2,
    y: 175.4,
    x: 204.2,
  },
  {
    id: 'bedwetting',
    label: 'Mouille son lit',
    page: 5,
    answerKey: 'dailyLife',
    pdfPage: 2,
    y: 147.6,
    x: 204.2,
  },
  {
    id: 'glasses',
    label: 'Port de lunettes ou de lentilles',
    page: 5,
    answerKey: 'equipment',
    pdfPage: 3,
    y: 760.9,
    x: 204.2,
  },
  {
    id: 'hearingAid',
    label: 'Prothèses auditives',
    page: 5,
    answerKey: 'equipment',
    pdfPage: 3,
    y: 733.9,
    x: 204.2,
  },
  {
    id: 'dental',
    label: 'Prothèses dentaires / appareil dentaire',
    page: 5,
    answerKey: 'equipment',
    pdfPage: 3,
    y: 706.1,
    x: 204.2,
  },
  {
    id: 'nosebleed',
    label: 'Saignements de nez',
    page: 5,
    answerKey: 'dailyLife',
    pdfPage: 3,
    y: 678.3,
    x: 204.2,
  },
  {
    id: 'insoles',
    label: 'Semelles orthopédiques',
    page: 5,
    answerKey: 'equipment',
    pdfPage: 3,
    y: 651.3,
    x: 204.2,
  },
  {
    id: 'fearAnimals',
    label: 'Peur des animaux',
    page: 5,
    answerKey: 'fears',
    pdfPage: 3,
    y: 553.7,
    x: 129.1,
  },
  {
    id: 'fearWater',
    label: 'Peur de l’eau',
    page: 5,
    answerKey: 'fears',
    pdfPage: 3,
    y: 525.9,
    x: 129.1,
  },
  {
    id: 'fearDark',
    label: 'Peur du noir',
    page: 5,
    answerKey: 'fears',
    pdfPage: 3,
    y: 498.1,
    x: 129.1,
  },
  { id: 'vertigo', label: 'Vertige', page: 5, answerKey: 'fears', pdfPage: 3, y: 470.4, x: 129.1 },
] as const;
export const HEALTH_WEB_ITEMS = [
  { id: 'fearOther', label: 'Autre peur', page: 5, answerKey: 'fears' },
] as const;
/** Presentation only. Stable identifiers keep old free-text answers and explicit choices intact. */
export const HEALTH_SHEET_SECTIONS = [
  { id: 'identity', title: 'Identité et contacts', legacyPage: 0 },
  { id: 'history', title: 'Santé et traitements', legacyPage: 1 },
  { id: 'allergies', title: 'Allergies et alimentation', legacyPage: 3 },
  { id: 'vaccines', title: 'Vaccinations', legacyPage: 4 },
  { id: 'adaptations', title: 'Besoins et adaptations', legacyPage: 5 },
  { id: 'daily', title: 'Au quotidien', legacyPage: 5 },
  { id: 'fears', title: 'Peurs et autres informations', legacyPage: 5 },
  { id: 'review', title: 'Relecture et attestation', legacyPage: 6 },
] as const;
export const HEALTH_VACCINES = [
  'DTP',
  'Coqueluche',
  'Haemophilus influenzae',
  'Hépatite B',
  'Méningocoque C',
  'Pneumocoque',
  'ROR',
  'Tuberculose',
  'Autre vaccination',
] as const;
export const HEALTH_CONTACT_SLOTS = [
  'guardianExtra1',
  'guardianExtra2',
  'emergencyExtra1',
  'emergencyExtra2',
] as const;
export const HEALTH_CONTACT_COLUMNS = [
  ['name', 'Nom et prénom'],
  ['relation', 'Lien avec la personne'],
  ['phone', 'Téléphone 1'],
  ['phone2', 'Téléphone 2'],
] as const;
export const HEALTH_EXTRA_FIELDS: readonly (readonly [string, string])[] = [
  ...[...HEALTH_MODEL_ITEMS, ...HEALTH_WEB_ITEMS].map(
    (i) => ['detail_' + i.id, 'Précisions : ' + i.label] as const,
  ),
  ...HEALTH_VACCINES.flatMap(
    (v, n) =>
      [
        [`vaccine_${n}_name`, v + ' : nom du vaccin'],
        [`vaccine_${n}_date`, v + ' : date du rappel ou injections'],
      ] as const,
  ),
  ...HEALTH_CONTACT_SLOTS.flatMap((slot, n) =>
    HEALTH_CONTACT_COLUMNS.map(
      ([key, label]) =>
        [
          slot + '_' + key,
          (n < 2 ? 'Autre représentant légal ' + (n + 1) : 'Autre contact ' + (n - 1)) +
            ' : ' +
            label,
        ] as const,
    ),
  ),
  ['historyDate', 'Événement de santé : date ou période'],
  ['treatmentName', 'Nom du traitement'],
  ['treatmentType', 'Traitement quotidien, d’appoint ou de crise'],
];
export function healthSheetItems(section: string) {
  if (section === 'allergies') return HEALTH_MODEL_ITEMS.filter((i) => i.page === 3);
  const start = HEALTH_MODEL_ITEMS.findIndex(
    (i) =>
      i.id ===
      (section === 'adaptations'
        ? 'communicate'
        : section === 'daily'
          ? 'swimming'
          : 'fearAnimals'),
  );
  const count =
    section === 'adaptations' ? 17 : section === 'daily' ? 9 : section === 'fears' ? 4 : 0;
  const result = count ? [...HEALTH_MODEL_ITEMS.slice(start, start + count)] : [];
  return section === 'fears' ? [...result, ...HEALTH_WEB_ITEMS] : result;
}

export type HealthPresence = 'YES' | 'NO';
export const FOOD_ALLERGENS = [
  'GLUTEN',
  'CRUSTACEANS',
  'EGGS',
  'FISH',
  'PEANUTS',
  'SOYA',
  'MILK',
  'NUTS',
  'CELERY',
  'MUSTARD',
  'SESAME',
  'SULPHITES',
  'LUPIN',
  'MOLLUSCS',
] as const;
export interface StructuredHealth {
  answers: Record<string, string>;
  presence?: Record<string, HealthPresence>;
  foodAllergens: string[];
  page: number;
  revision: number;
  signedPayload?: string;
  /** PDF bytes are stored encrypted server-side and stripped from JSON responses. */
  signedPdf?: string;
  documentDigest?: string;
  signature: null | {
    name: string;
    capacity: string;
    at: string;
    digest: string;
    appearance?: SignatureAppearance;
    verification?: SignatureVerification;
  };
}
export const HEALTH_FIELDS: readonly string[] = [
  ...HEALTH_FORM_PAGES.flatMap((p) => p.fields.map((f) => f[0])),
  ...HEALTH_EXTRA_FIELDS.map((f) => f[0]),
];
export const EMPTY_HEALTH: StructuredHealth = {
  answers: {},
  foodAllergens: [],
  page: 0,
  revision: 0,
  signature: null,
};
/** No names, no free text, no narrow filters or exact small counts in catering output. */
export function cateringSummary(records: StructuredHealth[]) {
  return FOOD_ALLERGENS.flatMap((allergen) => {
    const n = records.filter((r) => r.foodAllergens.includes(allergen)).length;
    return n < 5
      ? []
      : [{ allergen, range: n < 10 ? '5–9' : n < 20 ? '10–19' : n < 50 ? '20–49' : '50+' }];
  });
}

export const FOOD_ALLERGEN_LABELS: Record<string, string> = {
  GLUTEN: 'Céréales contenant du gluten',
  CRUSTACEANS: 'Crustacés',
  EGGS: 'Œufs',
  FISH: 'Poissons',
  PEANUTS: 'Arachides',
  SOYA: 'Soja',
  MILK: 'Lait',
  NUTS: 'Fruits à coque',
  CELERY: 'Céleri',
  MUSTARD: 'Moutarde',
  SESAME: 'Sésame',
  SULPHITES: 'Sulfites',
  LUPIN: 'Lupin',
  MOLLUSCS: 'Mollusques',
};
