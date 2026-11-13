/**
 * Règle de doublon choisie par type de scan (repas = une fois par service,
 * entrée = répétable, bus = compté par montée).
 */
export enum AccessScanDuplicateRule {
  /** Plusieurs scans acceptés pour la même personne. */
  ALLOW = 'ALLOW',
  /** Un seul scan accepté par personne et par serviceKey (ex. repas du midi). */
  UNIQUE_PER_SERVICE = 'UNIQUE_PER_SERVICE',
  /** Un seul scan accepté par personne et par jour calendaire. */
  UNIQUE_PER_DAY = 'UNIQUE_PER_DAY',
}
