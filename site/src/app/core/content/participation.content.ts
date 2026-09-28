import {
  JourneyStep,
  KeyFigure,
  ParticipationProfile,
  QuoteContent,
} from '../models/content.models';

/** Cartes d'orientation de la page « Participer ». */
export const participationProfiles: ParticipationProfile[] = [
  {
    id: 'jeune',
    title: 'Je suis jeune (12-18 ans)',
    description:
      'Tu as entre 12 et 18 ans et tu veux vivre un temps fort de rencontres, de prière et de fête ? Alegria est fait pour toi.',
    ctaLabel: 'Voir l’inscription jeunes',
    ctaLink: '/inscription/jeunes',
  },
  {
    id: 'famille',
    title: 'Je deviens famille d’accueil',
    description:
      'Proposez un hébergement pour les jeunes du rassemblement. La coordination vous accompagne et organise les affectations dans les familles.',
    ctaLabel: 'Proposer un accueil',
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
      'Vous accompagnez plusieurs groupes de votre diocèse ? Retrouvez les informations utiles pour coordonner leur venue.',
    ctaLabel: 'Voir la page Contact',
    ctaLink: '/contact',
  },
  {
    id: 'decouverte',
    title: 'Je découvre le MEJ',
    description:
      'Vous ne connaissez pas encore le MEJ mais vous êtes curieux de vivre cette expérience ? Vous êtes les bienvenus, Alegria est ouvert à tous.',
    ctaLabel: 'Découvrir l’événement',
    ctaLink: '/evenement',
  },
];

/** Parcours des foyers proposant un hébergement pour le rassemblement. */
export const familyJourneySteps: JourneyStep[] = [
  {
    title: 'Je propose un accueil',
    description: 'Je renseigne mes coordonnées, mes capacités et mes contraintes d’hébergement.',
  },
  {
    title: 'J’échange avec la coordination',
    description: 'Nous précisons ensemble les possibilités et les modalités d’accueil.',
  },
  {
    title: 'La coordination valide ma proposition',
    description: 'L’équipe confirme les conditions de l’accueil avec moi.',
  },
  {
    title: 'L’équipe affecte les jeunes',
    description: 'La coordination organise la répartition des jeunes dans les familles.',
  },
  {
    title: 'Je prépare l’accueil',
    description: 'Je prépare l’arrivée des jeunes avec les informations transmises par l’équipe.',
  },
];

/** Valeurs mises en avant sur la page Événement. */
export const eventValues: { title: string; description: string }[] = [
  {
    title: 'Rencontre',
    description: 'Se rencontrer entre jeunes venus de toute la France et du Christ.',
  },
  { title: 'Confiance', description: 'Vivre une expérience collective encadrée et sécurisée.' },
  { title: 'Joie', description: 'Célébrer, danser, rire et partager des moments de fête.' },
  { title: 'Engagement', description: 'S’engager pour soi, pour les autres et pour le monde.' },
  { title: 'Fraternité', description: 'Vivre en équipe, s’entraider et grandir ensemble.' },
  { title: 'Ouverture', description: 'Accueillir toutes celles et ceux qui découvrent le MEJ.' },
  {
    title: 'Foi',
    description: 'Vivre des temps spirituels accessibles à tous, croyants ou en recherche.',
  },
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
