/**
 * Types d'équipes opérationnelles PROPOSÉS (fonctions de terrain uniquement, pas de profils de droits).
 * Liste de départ non validée : l'admin peut renommer, désactiver ou ajouter des types.
 * Un type ne donne aucun droit.
 */
export const PROPOSED_VOLUNTEER_TEAM_TYPES: readonly [string, string, string][] = [
  ['ACCUEIL', 'Accueil et badges', 'Accueil des participants, remise et suivi des badges.'],
  ['SECURITE', 'Sécurité', "Sécurité des sites et des événements, circulation, service d'ordre."],
  ['RESTAURATION', 'Restauration', 'Préparation et service des repas.'],
  [
    'ANIMATION_PROGRAMME',
    'Animation et programme',
    'Animation, célébrations et déroulé du programme.',
  ],
  [
    'LOGISTIQUE_TRANSPORTS',
    'Logistique et transports',
    'Matériel, installation, cars et missions de terrain.',
  ],
  ['SANTE_SECOURS', 'Santé et secours', 'Premiers secours et suivi des situations de santé.'],
  [
    'HEBERGEMENT_FAMILLES',
    "Hébergement et familles d'accueil",
    "Familles d'accueil, hébergements collectifs et placement.",
  ],
  ['SCANNERS', "Contrôle d'accès (scanners)", 'Scan des badges sur le terrain.'],
  ['COORDINATION', 'Coordination', 'Coordination générale et liaison entre les équipes.'],
];
