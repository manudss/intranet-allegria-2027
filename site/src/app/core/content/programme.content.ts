import { ProgramDay } from '../models/content.models';

/**
 * Programme prévisionnel des 4 jours d'Alegria 2027.
 * Statut « draft » : les horaires précis ne sont pas encore arrêtés.
 * Structure inspirée du déroulé habituel des rassemblements MEJ (temps collectifs,
 * ateliers, temps spirituels, repas, temps libres) — à affiner par l'équipe de pilotage.
 */
export const programDays: ProgramDay[] = [
  {
    id: 'jour-1',
    date: '30 octobre 2027',
    weekday: 'Samedi',
    title: 'Arrivée et ouverture du rassemblement',
    intention: 'Se rencontrer, s’installer et entrer ensemble dans la fête.',
    status: 'draft',
    blocks: [
      { type: 'pratique', label: 'Accueil des participants', description: 'Détails à venir.' },
      { type: 'collectif', label: 'Grand temps d’ouverture' },
      { type: 'repas', label: 'Repas partagé' },
      { type: 'spirituel', label: 'Temps de prière d’ouverture' },
      { type: 'libre', label: 'Veillée de lancement' },
    ],
  },
  {
    id: 'jour-2',
    date: '31 octobre 2027',
    weekday: 'Dimanche',
    title: 'Journée de rencontre et d’ateliers',
    intention: 'Vivre la fraternité à travers des activités partagées.',
    status: 'draft',
    blocks: [
      { type: 'spirituel', label: 'Temps spirituel du matin' },
      { type: 'atelier', label: 'Ateliers thématiques au choix' },
      { type: 'repas', label: 'Repas' },
      { type: 'atelier', label: 'Ateliers créatifs et sportifs' },
      { type: 'collectif', label: 'Célébration en soirée' },
    ],
  },
  {
    id: 'jour-3',
    date: '1er novembre 2027',
    weekday: 'Lundi',
    title: 'Journée spirituelle et festive',
    intention: 'Approfondir, célébrer et se laisser surprendre par la joie.',
    status: 'draft',
    blocks: [
      { type: 'spirituel', label: 'Grande célébration' },
      { type: 'collectif', label: 'Temps forts en équipes' },
      { type: 'repas', label: 'Repas festif' },
      { type: 'libre', label: 'Temps libre et découverte de Saint-Étienne' },
      { type: 'collectif', label: 'Soirée festive' },
    ],
  },
  {
    id: 'jour-4',
    date: '2 novembre 2027',
    weekday: 'Mardi',
    title: 'Envoi et retour',
    intention: 'Repartir avec la joie vécue ensemble et l’envie de la partager.',
    status: 'draft',
    blocks: [
      { type: 'spirituel', label: 'Temps d’envoi' },
      { type: 'collectif', label: 'Bilan et au revoir' },
      { type: 'pratique', label: 'Départs échelonnés', description: 'Détails à venir.' },
    ],
  },
];

/** Message affiché tant que le programme détaillé n'est pas publié. */
export const PROGRAM_PLACEHOLDER_NOTICE = 'Le programme détaillé sera publié prochainement.';
