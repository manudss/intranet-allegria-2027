import { VolunteerMission } from '../models/content.models';

/**
 * Domaines de mission bénévole envisagés pour Alegria 2027.
 * Toutes les missions sont marquées « draft » : la liste définitive sera confirmée
 * par l'équipe de pilotage à mesure que l'organisation avance.
 */
export const volunteerMissions: VolunteerMission[] = [
  {
    id: 'accueil',
    label: 'Accueil',
    description:
      "Accueillir les participants à leur arrivée, orienter les familles et les jeunes, tenir les points d'information.",
    status: 'draft',
  },
  {
    id: 'logistique',
    label: 'Logistique',
    description:
      "Installer et ranger les espaces, gérer le matériel, coordonner les flux entre les différents lieux du rassemblement.",
    status: 'draft',
  },
  {
    id: 'transport',
    label: 'Transport',
    description:
      "Accompagner les participants entre les lieux d'accueil, la gare et le site du rassemblement.",
    status: 'draft',
  },
  {
    id: 'hebergement',
    label: 'Hébergement',
    description: "Coordonner les solutions d'hébergement et accompagner les familles hôtes.",
    status: 'draft',
  },
  {
    id: 'restauration',
    label: 'Restauration',
    description: 'Préparer et servir les repas, gérer les régimes particuliers signalés.',
    status: 'draft',
  },
  {
    id: 'securite',
    label: 'Sécurité',
    description:
      'Veiller à la sécurité des participants et des lieux, en lien avec la commission sécurité du rassemblement.',
    status: 'draft',
  },
  {
    id: 'sante',
    label: 'Santé',
    description:
      "Assurer une présence médicale et paramédicale (infirmerie), veiller au bien-être des participants.",
    status: 'draft',
  },
  {
    id: 'animation',
    label: 'Animation',
    description: 'Concevoir et animer des temps collectifs, ateliers et veillées.',
    status: 'draft',
  },
  {
    id: 'liturgie',
    label: 'Liturgie',
    description: 'Préparer et accompagner les temps spirituels et célébrations.',
    status: 'draft',
  },
  {
    id: 'communication',
    label: 'Communication',
    description: 'Relayer les informations avant et pendant le rassemblement, animer les réseaux.',
    status: 'draft',
  },
  {
    id: 'photo-video',
    label: 'Photographie et vidéo',
    description: "Garder une mémoire visuelle de l'événement dans le respect du droit à l'image des mineurs.",
    status: 'draft',
  },
  {
    id: 'accompagnement-jeunes',
    label: 'Accompagnement des jeunes',
    description: "Encadrer un groupe de jeunes au quotidien, veiller à leur sécurité et leur bien-être.",
    status: 'draft',
  },
  {
    id: 'installation-rangement',
    label: 'Installation et rangement',
    description: 'Participer aux temps de montage et démontage des espaces du rassemblement.',
    status: 'draft',
  },
  {
    id: 'coordination',
    label: 'Coordination',
    description: "Piloter une équipe de bénévoles et faire le lien avec l'équipe d'organisation générale.",
    status: 'draft',
  },
];
