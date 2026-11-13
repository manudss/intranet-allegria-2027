/**
 * Réglages du contrôle d'accès. Les valeurs marquées "proposition du plan"
 * sont des choix sûrs pris en attendant les décisions d'Emmanuel
 * (questions ouvertes du plan QR) : elles restent modifiables.
 */
export const ACCESS_CONTROL_ROLES = {
  /** Peut scanner (rôle limité par zone et période via les grants). */
  scanner: 'SCANNER',
  /** Peut gérer le stock, attribuer/remplacer/révoquer, régler et habiliter. */
  badgeManager: 'BADGE_MANAGER',
} as const;

/** Durée maximale d'une session de scan (entrée en mode scan → expiration). */
export const SCAN_SESSION_TTL_MINUTES = 12 * 60;

/**
 * Durée de validité de la clé de chiffrement local : le téléphone doit la
 * redemander au serveur (renouvellement en ligne) pour continuer à lire
 * ses données. Garde-fou, pas garantie d'effacement à distance.
 */
export const SCAN_SESSION_KEY_TTL_MINUTES = 30;

/** Proposition du plan : limitation de débit du repli en ligne, par scanner. */
export const LOOKUP_RATE_LIMIT_PER_MINUTE = 20;

/** Fenêtre de rafale pour remonter les codes inconnus répétés au journal. */
export const UNKNOWN_CODE_BURST_WINDOW_MINUTES = 5;
