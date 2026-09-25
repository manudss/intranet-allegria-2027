import { JourneyStep, KeyFigure, ParticipationProfile, QuoteContent } from '../models/content.models';

/** Cartes d'orientation de la page « Participer ». */
export const participationProfiles: ParticipationProfile[] = [
  {
    id: 'jeune',
    title: 'Je suis jeune (12-18 ans)',
    description:
      "Tu as entre 12 et 18 ans et tu veux vivre un temps fort de rencontres, de prière et de fête ? Alegria est fait pour toi.",
    ctaLabel: 'Voir l’inscription jeunes',
    ctaLink: '/inscription/jeunes',
  },
  {
    id: 'famille',
    title: 'Je suis parent ou famille',
    description:
      "Vous souhaitez inscrire votre enfant et comprendre les modalités pratiques ? Retrouvez toutes les informations pour préparer sereinement sa venue.",
    ctaLabel: 'Voir l’inscription familles',
    ctaLink: '/inscription/familles',
  },
  {
    id: 'animateur',
    title: 'Je suis animateur',
    description:
      "Vous accompagnez un groupe de jeunes à l'année ? Retrouvez comment préparer et vivre Alegria avec votre équipe.",
    ctaLabel: 'Découvrir mon rôle',
    ctaLink: '/evenement',
  },
  {
    id: 'benevole',
    title: 'Je deviens bénévole ou volontaire',
    description:
      'Donnez de votre temps avant ou pendant le rassemblement pour que cette aventure collective soit possible.',
    ctaLabel: 'Voir l’inscription bénévoles',
    ctaLink: '/inscription/benevoles',
  },
  {
    id: 'responsable',
    title: 'Je suis responsable diocésain',
    description:
      "Vous accompagnez plusieurs groupes de votre diocèse ? Retrouvez les informations utiles pour coordonner leur venue.",
    ctaLabel: 'Voir la page Contact',
    ctaLink: '/contact',
  },
  {
    id: 'decouverte',
    title: 'Je découvre le MEJ',
    description:
      "Vous ne connaissez pas encore le MEJ mais vous êtes curieux de vivre cette expérience ? Vous êtes les bienvenus, Alegria est ouvert à tous.",
    ctaLabel: 'Découvrir l’événement',
    ctaLink: '/evenement',
  },
];

/** Parcours d'inscription en 7 étapes pour les familles. */
export const familyJourneySteps: JourneyStep[] = [
  { title: 'Je découvre l’événement', description: 'Je prends connaissance d’Alegria 2027 et de son esprit.' },
  {
    title: 'Je vérifie les conditions de participation',
    description: 'Âge, adhésion MEJ et informations pratiques disponibles.',
  },
  {
    title: 'Je prépare les informations nécessaires',
    description: 'Coordonnées, transport envisagé, besoins particuliers.',
  },
  { title: 'J’inscris le ou les jeunes', description: 'Je complète le formulaire d’inscription en ligne.' },
  {
    title: 'Je complète les documents demandés',
    description: 'Autorisations, fiche sanitaire et autres pièces éventuelles.',
  },
  { title: 'Je reçois la confirmation', description: 'L’équipe d’organisation confirme l’inscription.' },
  { title: 'Je prépare le départ', description: 'Je consulte les informations pratiques finales avant le jour J.' },
];

/** Valeurs mises en avant sur la page Événement. */
export const eventValues: { title: string; description: string }[] = [
  { title: 'Rencontre', description: 'Se rencontrer entre jeunes venus de toute la France et du Christ.' },
  { title: 'Confiance', description: 'Vivre une expérience collective encadrée et sécurisée.' },
  { title: 'Joie', description: 'Célébrer, danser, rire et partager des moments de fête.' },
  { title: 'Engagement', description: 'S’engager pour soi, pour les autres et pour le monde.' },
  { title: 'Fraternité', description: 'Vivre en équipe, s’entraider et grandir ensemble.' },
  { title: 'Ouverture', description: 'Accueillir toutes celles et ceux qui découvrent le MEJ.' },
  { title: 'Foi', description: 'Vivre des temps spirituels accessibles à tous, croyants ou en recherche.' },
];

/** Chiffres clés — historiques (édition précédente), à mettre à jour avec les données 2027. */
export const previousEditionFigures: KeyFigure[] = [
  { value: '4 jours', label: 'de rassemblement national' },
  { value: 'Toute la France', label: 'de jeunes et diocèses représentés' },
  { value: '3 encadrants', label: 'animateurs, bénévoles et volontaires mobilisés' },
];

export const eventQuote: QuoteContent = {
  text: 'Croire en ce monde tel qu’il est, avec ses joies et ses difficultés, parce que nous croyons que Dieu y est à l’œuvre, ici et maintenant.',
  attribution: 'Esprit des rassemblements Alegria du MEJ',
};
