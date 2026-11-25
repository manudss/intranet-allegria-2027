/**
 * Types d'équipes PROPOSÉS (note « Droits Alegria », 25 nov. 2026). Liste de départ non validée :
 * l'admin peut renommer, désactiver ou ajouter des types.
 */
export const PROPOSED_VOLUNTEER_TEAM_TYPES: readonly [string, string, string][] = [
  [
    'ADMINISTRATION_TECHNIQUE',
    'Administration technique',
    "Configure l'application, les utilisateurs et les droits.",
  ],
  ['COORDINATION_GENERALE', 'Coordination générale', "Pilote l'ensemble du rassemblement."],
  ['SANTE_SECOURS', 'Santé et secours', 'Suit les dossiers santé et les incidents.'],
  ['RESTAURATION', 'Restauration', 'Prépare les repas : effectifs, régimes, fournisseurs.'],
  [
    'HEBERGEMENT_FAMILLES',
    "Hébergement et familles d'accueil",
    'Gère les familles, les hébergements collectifs et le placement.',
  ],
  ['LOGISTIQUE_TRANSPORTS', 'Logistique et transports', 'Matériel, cars, missions de terrain.'],
  ['ACCUEIL_BADGES', 'Accueil et badges', 'Imprime et attribue les badges, suit les accès.'],
  ['SCANNERS', 'Scanners', 'Scanne les badges sur le terrain.'],
  [
    'ANIMATION_PROGRAMME',
    'Animation et programme',
    'Construit le programme, répartit les jeunes dans les équipes de rassemblement.',
  ],
  ['RESPONSABLE_EQUIPE', "Responsable d'équipe bénévole", 'Pilote une équipe bénévole.'],
  ['BENEVOLE', 'Bénévole', "Membre d'une équipe bénévole."],
  ['CONSULTATION', 'Consultation', 'Lecture seule.'],
];
