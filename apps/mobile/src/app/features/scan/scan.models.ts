/** Modèles du mode scan hors-ligne — alignés sur l'API access-control (PR 1). */

export type DuplicateRule = 'ALLOW' | 'UNIQUE_PER_SERVICE' | 'UNIQUE_PER_DAY';

export interface AccessZone {
  id: number;
  name: string;
  description: string | null;
  allowedPersonTypes: string[] | null;
  requiresOnlineValidation: boolean;
  maxOfflineMinutes: number;
  points?: ScanPoint[];
}

export interface ScanPoint {
  expectedOnlineRequired?: boolean;
  id: number;
  zoneId: number;
  scanTypeId: number;
  name: string;
  serviceKey: string | null;
  active: boolean;
  zone?: AccessZone;
  scanType?: ScanType;
}

export interface ScanType {
  id: number;
  code: string;
  label: string;
  description: string | null;
  duplicateRule: DuplicateRule;
}

/** Ligne d'instantané servie par l'API : le minimum utile au verdict. */
export interface SnapshotEntry {
  assignmentId: number;
  code: string;
  firstName: string;
  lastName: string;
  personType: string;
  version: number;
}

export interface ScanSessionStart {
  sessionId: number;
  zoneId: number | null;
  startedAt: string;
  expiresAt: string;
  keyExpiresAt: string;
  sessionKey: string;
  snapshotVersion: number;
  maxOfflineMinutes: number;
  requiresOnlineValidation: boolean;
  snapshot: SnapshotEntry[];
}

export interface ScanDelta {
  requiresOnlineValidation?: boolean;
  version: number;
  upserts: SnapshotEntry[];
  revokedAssignmentIds: number[];
}

export interface PendingScan {
  clientAccepted?: boolean;
  clientEventId: string;
  code: string;
  pointId: number;
  assignmentId?: number;
  tableVersion?: number;
  occurredAtLocal?: string;
  serviceKey?: string;
}

export type ServerVerdict =
  | 'ACCEPTED'
  | 'REJECTED_NOT_EXPECTED'
  | 'DUPLICATE'
  | 'REJECTED_UNKNOWN'
  | 'REJECTED_REVOKED'
  | 'REJECTED_NO_RIGHT'
  | 'REJECTED_EXPIRED_ASSIGNMENT';

export interface ScanVerdictResult {
  eventId?: number;
  needsReview?: boolean;
  exceptionAllowed?: boolean;
  passages?: { id: number; groupId: number; groupName: string }[];
  clientEventId: string;
  verdict: ServerVerdict;
  duplicateOfEventId?: number;
}

export interface LookupResult {
  verdict: ServerVerdict;
  firstName?: string;
  lastName?: string;
}

export type VerdictKind = 'ok' | 'already' | 'ko' | 'unknown' | 'expired' | 'offline';

export interface Verdict {
  eventId?: number;
  exceptionAllowed?: boolean;
  exceptionConfirmed?: boolean;
  passages?: { id: number; groupId: number; groupName: string }[];
  kind: VerdictKind;
  title: string;
  detail: string;
  /** Compteur de service (direction C) après ce scan, si applicable. */
  servedCount?: number;
}

/**
 * Évalue un scan contre l'instantané local.
 * `seenKeys` contient les clés de doublon déjà acceptées localement :
 *  - UNIQUE_PER_DAY : le code seul
 *  - UNIQUE_PER_SERVICE : code + serviceKey
 *  - ALLOW : jamais de doublon
 * `servedSoFar` : nombre de passages déjà acceptés sur ce service (compteur C).
 */
export function evaluateScan(
  entry: SnapshotEntry | undefined,
  rule: DuplicateRule,
  serviceKey: string | null,
  seenKeys: ReadonlySet<string>,
  servedSoFar: number,
): Verdict {
  if (!entry) {
    return {
      kind: 'unknown',
      title: 'Badge inconnu',
      detail: 'Vérifiez le badge avec un référent.',
    };
  }
  const name = `${entry.firstName} ${entry.lastName}`;
  const dupKey = rule === 'UNIQUE_PER_SERVICE' ? `${entry.code}|${serviceKey ?? ''}` : entry.code;
  if (rule !== 'ALLOW' && seenKeys.has(dupKey)) {
    return {
      kind: 'already',
      title: 'Déjà validé',
      detail: `${name} a déjà été validé ici.`,
      servedCount: rule === 'UNIQUE_PER_SERVICE' ? servedSoFar : undefined,
    };
  }
  return {
    kind: 'ok',
    title: 'OK',
    detail: name,
    servedCount: rule === 'UNIQUE_PER_SERVICE' ? servedSoFar + 1 : undefined,
  };
}

/** Clé de doublon locale pour marquer un scan accepté. */
export function duplicateKeyOf(
  code: string,
  rule: DuplicateRule,
  serviceKey: string | null,
): string {
  return rule === 'UNIQUE_PER_SERVICE' ? `${code}|${serviceKey ?? ''}` : code;
}
