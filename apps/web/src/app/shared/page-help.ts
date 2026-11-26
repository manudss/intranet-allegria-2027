/**
 * Gabarit de page : pour chaque écran, une phrase « À quoi sert cette page ».
 * Clé = chemin de la route (`routeConfig.path`).
 * `shell: true` = la page n'utilise pas `app-page-layout` : le bandeau est alors
 * affiché par la coque de l'application (layout), sous l'en-tête.
 */
export interface PageHelp {
  readonly purpose: string;
  readonly shell?: boolean;
}

export const PAGE_HELP: Readonly<Record<string, PageHelp>> = {
  accueil: { purpose: "Vue d'ensemble de votre rôle et raccourcis vers vos pages.", shell: true },
  rassemblement: { purpose: 'Les délégations, leurs arrivées et leurs départs.' },
  'groupes-rassemblement': {
    purpose:
      'Dispatch des équipes entières dans des groupes de rassemblement par moment (jeu, repas, veillée), avec capacités en personnes.',
  },
  participants: { purpose: 'Rechercher un participant et consulter ou modifier sa fiche.' },
  'inscriptions-familles': { purpose: "Suivre et relire les dossiers d'inscription des familles, sans donnée de santé." },
  'dossiers-sanitaires': { purpose: 'Consulter les fiches de santé des jeunes. Réservé au rôle Santé.' },
  'restauration-besoins': { purpose: 'Connaître les régimes et les besoins de restauration. Réservé au rôle Logistique repas.' },
  equipes: { purpose: "Les équipes de rassemblement : leurs membres et leur groupe d'origine." },
  'equipes/repartition': { purpose: 'Répartir les jeunes dans les équipes en trois étapes. Rien n’est enregistré avant la validation.' },
  familles: { purpose: "Les familles d'accueil et le nombre de couchages proposés." },
  benevoles: { purpose: 'Consulter, ajouter et suivre les bénévoles et leurs affectations.' },
  'benevoles/repartition': { purpose: 'Répartir les bénévoles dans les équipes en trois étapes. Rien n’est enregistré avant la validation.' },
  'equipes-operationnelles': { purpose: 'Les équipes de bénévoles qui font vivre le rassemblement, avec leur responsable.' },
  'missions-benevoles': { purpose: 'Les missions, leurs créneaux horaires et les bénévoles affectés.' },
  'journal-benevoles': { purpose: 'L’historique des changements sur les bénévoles et leurs missions.' },
  hebergement: { purpose: 'Les logements des jeunes : familles d’accueil, hébergements collectifs et capacités.' },
  'hebergement/carte': { purpose: 'Les logements placés sur une carte.' },
  'hebergement/placement': { purpose: 'Placer les équipes dans les logements, avec une proposition à valider.' },
  transports: { purpose: 'Planifier les transports des groupes.', shell: true },
  glossaire: { purpose: 'Le vocabulaire commun de l’intranet : un seul nom par notion, avec les formats de date et d’heure.' },
  programme: { purpose: 'Le programme des quatre jours (J1 à J4) : séquences, lieux et publication de la liste publique.' },
  'programme/journal': { purpose: 'L’historique des modifications du programme.' },
  'programme/evenements/:id': { purpose: 'Toutes les informations d’un événement : horaires, missions, tâches et documents.' },
  'jour-j': { purpose: 'Suivre en direct les missions, les équipes et les alertes d’une journée.' },
  'suivi-operationnel': { purpose: 'Suivre l’avancement des missions pendant le rassemblement.' },
  incidents: { purpose: 'Suivre les incidents et les demandes du terrain.', shell: true },
  'consignes-docs': { purpose: 'Retrouver les consignes et les documents utiles à votre rôle.', shell: true },
  'parametres-roles': { purpose: 'Gérer les droits d’accès de chaque rôle.', shell: true },
  'donnees-exports': { purpose: 'Exporter les données et contrôler leur qualité.', shell: true },
  'acces/impression': { purpose: 'Préparer et imprimer les badges, avec confirmation avant impression.' },
  'acces/badges': { purpose: 'L’état des badges : attribués, libres ou perdus.', shell: true },
  'acces/attribution': { purpose: 'Attribuer un badge à une personne, ou le remplacer.', shell: true },
  'acces/habilitations': { purpose: 'Autoriser des personnes à scanner les badges, pour une durée donnée.', shell: true },
  'acces/configuration': { purpose: 'Régler les types de scan, les zones et les points de contrôle. Réservé aux administrateurs.', shell: true },
  'acces/journal': { purpose: 'Les scans enregistrés, du plus récent au plus ancien.', shell: true },
  'acces/suivi': { purpose: 'Ce qu’il faut traiter maintenant : présence estimée, repas servis et scans à vérifier.', shell: true },
  'acces/groupes': { purpose: 'Les groupes attendus et leurs passages prévus.', shell: true },
  'acces/historique-groupe': { purpose: 'Les passages d’un groupe, scan après scan.', shell: true },
  'acces/historique-personne': { purpose: 'Les passages d’une personne, scan après scan.', shell: true },
  'acces/dashboard': { purpose: 'Les chiffres d’accès du rassemblement.', shell: true },
  'acces/scannes': { purpose: 'Les personnes scannées, par lieu.', shell: true },
  'acces/non-scannes': { purpose: 'Les groupes attendus qui ne sont pas encore passés.', shell: true },
  'acces/groupes-exceptions': { purpose: 'Les groupes attendus qui présentent une exception.', shell: true },
};
