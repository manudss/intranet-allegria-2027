import { FaqCategory } from '../models/content.models';

/**
 * Contenu éditorial de la FAQ familles, organisé par catégories.
 * Facilement modifiable sans toucher aux composants.
 */
export const faqCategories: FaqCategory[] = [
  {
    id: 'inscription',
    label: 'Inscription',
    items: [
      {
        id: 'comment-inscrire',
        question: "Comment inscrire mon jeune ou ma famille à Alegria 2027 ?",
        answer:
          "L'inscription se fera via un formulaire dédié, accessible depuis les pages « Inscription jeunes » et « Inscription familles ». Le lien sera activé dès l'ouverture officielle des inscriptions.",
      },
      {
        id: 'ouverture-inscriptions',
        question: 'Quand ouvrent les inscriptions ?',
        answer:
          "La date d'ouverture des inscriptions n'est pas encore fixée. Elle sera annoncée sur cette page et relayée par votre diocèse ou groupe MEJ.",
      },
      {
        id: 'modifier-inscription',
        question: 'Puis-je modifier une inscription après l’avoir envoyée ?',
        answer:
          "Les modalités de modification seront précisées dans la confirmation d'inscription. Contactez l'équipe d'organisation en cas de besoin urgent.",
      },
    ],
  },
  {
    id: 'age-profils',
    label: 'Âge et profils',
    items: [
      {
        id: 'age-concerne',
        question: 'À partir de quel âge peut-on participer ?',
        answer:
          "Alegria 2027 s'adresse principalement aux jeunes de 12 à 18 ans, accompagnés par des animateurs et responsables. Les familles et bénévoles adultes sont également les bienvenus.",
      },
      {
        id: 'decouverte-mej',
        question: 'Faut-il déjà être membre du MEJ pour participer ?',
        answer:
          "Cette règle n'est pas encore confirmée. Alegria se veut ouvert à celles et ceux qui découvrent le mouvement comme aux membres déjà engagés.",
      },
    ],
  },
  {
    id: 'tarifs',
    label: 'Tarifs',
    items: [
      {
        id: 'montant',
        question: 'Quel est le tarif de participation ?',
        answer:
          "Les tarifs ne sont pas encore fixés. Ils seront communiqués avant l'ouverture des inscriptions, avec un barème adapté et des possibilités d'aide.",
      },
      {
        id: 'aide-financiere',
        question: "Existe-t-il une aide en cas de difficulté financière ?",
        answer:
          "Une solidarité entre participants est envisagée. Si le coût est un frein, contactez l'équipe d'organisation avant de renoncer à l'inscription.",
      },
    ],
  },
  {
    id: 'transport',
    label: 'Transport',
    items: [
      {
        id: 'venir-comment',
        question: 'Comment se rendre à Saint-Étienne ?',
        answer:
          "Le Centre de Congrès est accessible depuis la gare de Saint-Étienne Châteaucreux et par les transports en commun locaux. Le détail des modalités de transport collectif sera précisé ultérieurement.",
      },
    ],
  },
  {
    id: 'hebergement',
    label: 'Hébergement',
    items: [
      {
        id: 'ou-dormir',
        question: 'Où seront hébergés les participants ?',
        answer:
          "Les modalités d'hébergement ne sont pas encore confirmées. Elles seront communiquées avec les informations pratiques définitives.",
      },
    ],
  },
  {
    id: 'repas',
    label: 'Repas',
    items: [
      {
        id: 'regimes-particuliers',
        question: 'Les régimes alimentaires particuliers sont-ils pris en compte ?',
        answer:
          "Un espace du formulaire d'inscription permettra de signaler les régimes particuliers (allergies, convictions religieuses, végétarien...). Les modalités précises seront communiquées ultérieurement.",
      },
    ],
  },
  {
    id: 'sante',
    label: 'Santé',
    items: [
      {
        id: 'besoins-specifiques',
        question: 'Comment signaler un besoin de santé particulier ?',
        answer:
          "Le formulaire d'inscription comportera une rubrique dédiée aux informations de santé, traitée de façon confidentielle par l'équipe santé de l'événement.",
      },
    ],
  },
  {
    id: 'securite',
    label: 'Sécurité',
    items: [
      {
        id: 'encadrement-securite',
        question: 'Quelles sont les mesures de sécurité prévues ?',
        answer:
          "L'organisation met en place une équipe sécurité et santé dédiée, ainsi qu'un encadrement adapté à chaque tranche d'âge. Le détail des dispositifs sera publié avant l'événement.",
      },
    ],
  },
  {
    id: 'accessibilite',
    label: 'Accessibilité',
    items: [
      {
        id: 'accessibilite-lieu',
        question: 'Le site est-il accessible aux personnes à mobilité réduite ?',
        answer:
          "Les informations d'accessibilité du Centre de Congrès de Saint-Étienne seront vérifiées et publiées sur la page « Lieu et accès ». Contactez l'organisation pour tout besoin spécifique.",
      },
    ],
  },
  {
    id: 'encadrement',
    label: 'Encadrement',
    items: [
      {
        id: 'qui-encadre',
        question: 'Qui encadre les jeunes pendant le rassemblement ?',
        answer:
          "Les jeunes sont accompagnés par des animateurs et responsables MEJ, ainsi que par une équipe de bénévoles formés. Les règles d'encadrement seront détaillées dans le livret pratique.",
      },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    items: [
      {
        id: 'documents-necessaires',
        question: "Quels documents faut-il préparer ?",
        answer:
          "La liste précise des documents (autorisation parentale, fiche sanitaire, etc.) sera communiquée avec la confirmation d'inscription.",
      },
    ],
  },
  {
    id: 'annulation',
    label: 'Annulation',
    items: [
      {
        id: 'politique-annulation',
        question: "Que se passe-t-il en cas d'annulation ?",
        answer:
          "La politique d'annulation et de remboursement n'est pas encore définie. Elle sera publiée avant l'ouverture des inscriptions.",
      },
    ],
  },
  {
    id: 'contact',
    label: 'Contact',
    items: [
      {
        id: 'qui-contacter',
        question: 'Qui contacter en cas de question ?',
        answer:
          "Rendez-vous sur la page Contact pour connaître les interlocuteurs dédiés aux familles, aux bénévoles et aux questions générales.",
      },
    ],
  },
];
