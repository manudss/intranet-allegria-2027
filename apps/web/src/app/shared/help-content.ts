/** Contenu de l'aide intégrée : visite guidée par rôle et glossaire des sigles. */
export interface HelpStep {
  readonly title: string;
  readonly text: string;
}

export interface GlossaryEntry {
  readonly term: string;
  readonly meaning: string;
}

export const ACRONYM_HINTS = {
  TA: "TA : Témoins Aujourd'hui, 12 à 15 ans.",
  ES: 'ES : Équipes Espérance, 15 à 18 ans.',
} as const;

export const GLOSSARY: readonly GlossaryEntry[] = [
  { term: 'TA', meaning: "Témoins Aujourd'hui, la branche des 12 à 15 ans." },
  { term: 'ES', meaning: 'Équipes Espérance, la branche des 15 à 18 ans.' },
  { term: 'Habilitation', meaning: 'Autorisation donnée à une personne de scanner les badges, pour une durée donnée.' },
];

const COMMON_STEPS: readonly HelpStep[] = [
  {
    title: 'Le menu',
    text: 'Le menu à gauche regroupe les pages par thème. Sur téléphone, il s’ouvre avec le bouton à trois barres en haut à gauche. Vous ne voyez que les pages de votre rôle.',
  },
  {
    title: 'À quoi sert la page',
    text: 'Sous le titre, une phrase explique à quoi sert la page. Si vous hésitez, relisez-la avant de modifier quoi que ce soit.',
  },
];

const ROLE_STEP: Readonly<Record<string, HelpStep>> = {
  ADMIN: {
    title: 'Votre rôle : administration',
    text: 'Vous avez accès à toutes les pages, dont les paramètres et les rôles. Les modifications sensibles demandent une confirmation qui nomme l’objet concerné.',
  },
  COORDINATOR: {
    title: 'Votre rôle : coordination',
    text: 'Vous suivez les participants, les équipes et les bénévoles. Les répartitions se font en trois étapes et rien n’est enregistré avant la validation.',
  },
  HEALTH: {
    title: 'Votre rôle : santé',
    text: 'La page Dossiers sanitaires permet de consulter les fiches de santé des jeunes. Elles sont en lecture seule.',
  },
  CATERING: {
    title: 'Votre rôle : restauration',
    text: 'La page Besoins de restauration liste les régimes et les besoins à connaître pour les repas.',
  },
  SCANNER: {
    title: 'Votre rôle : contrôle d’accès',
    text: 'Vous scannez les badges aux points de contrôle. Une habilitation vous autorise à scanner pour une durée donnée.',
  },
  BADGE_MANAGER: {
    title: 'Votre rôle : badges',
    text: 'Vous gérez le stock de badges, leur attribution et leur remplacement en cas de perte.',
  },
};

const DEFAULT_ROLE_STEP: HelpStep = {
  title: 'Votre rôle : bénévole',
  text: 'Vous consultez les pages qui vous concernent. Si une page est refusée, contactez l’équipe de coordination.',
};

const ROLE_ORDER = ['ADMIN', 'COORDINATOR', 'HEALTH', 'CATERING', 'BADGE_MANAGER', 'SCANNER'];

/** Visite guidée de 3 étapes, la dernière dépend du rôle principal de la personne. */
export function tourFor(roles: readonly string[]): readonly HelpStep[] {
  const role = ROLE_ORDER.find((r) => roles.includes(r));
  return [...COMMON_STEPS, role ? ROLE_STEP[role] : DEFAULT_ROLE_STEP];
}
