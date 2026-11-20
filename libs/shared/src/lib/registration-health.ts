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
  foodAllergens: string[];
  page: number;
  revision: number;
  signedPayload?: string;
  signature: null | { name: string; capacity: string; at: string; digest: string };
}
export const HEALTH_FIELDS = HEALTH_FORM_PAGES.flatMap((p) => p.fields.map((f) => f[0]));
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
