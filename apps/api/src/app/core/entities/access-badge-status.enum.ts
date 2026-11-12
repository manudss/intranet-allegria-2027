/**
 * Cycle de vie d'un badge du stock pré-imprimé.
 * LOST et REVOKED ne reviennent jamais dans le stock actif pendant
 * l'événement (décision de sécurité proposée dans le plan QR, à valider).
 */
export enum AccessBadgeStatus {
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
  LOST = 'LOST',
  REVOKED = 'REVOKED',
  RETIRED = 'RETIRED',
}
