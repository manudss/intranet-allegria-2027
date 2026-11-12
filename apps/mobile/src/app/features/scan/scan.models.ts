/** Modèles du mode scan hors-ligne (miroir des DTO de l'API access-control). */

export type ScanPointType = 'ENTRY' | 'EXIT' | 'MEAL' | 'BUS' | 'ZONE' | 'GENERAL';
export type ScanTypeCode = 'ENTRY' | 'EXIT';

export interface ScanPointConfig {
  id: string;
  code: string;
  label: string;
  type: ScanPointType;
  active: boolean;
  config: Record<string, unknown> | null;
}

export interface ScanTypeConfig {
  id: string;
  code: string;
  label: string;
  description: string | null;
  oneWay: boolean;
  active: boolean;
}

/** Ligne de la table chiffrée téléchargée (indexée par hash du code QR). */
export interface ScanTableRow {
  qrCodeHash: string;
  firstName: string;
  lastName: string;
  teamName: string | null;
  participantType: string | null;
  badgeStatus: string;
  hasActivePass: boolean;
  checkedOutAt: string | null;
  servedMealCount: number;
}

export interface AccessTableDto {
  pointId: string;
  generatedAt: string;
  expiresAt: string;
  participants: ScanTableRow[];
}

export interface PendingScan {
  qrCodeHash: string;
  scannedAt: string;
  pointId: string;
  scanTypeCode: string;
  localSeq: number;
}

export interface ScanUploadResponse {
  processed: number;
  duplicated: number;
  rejected: { localSeq: number; qrCodeHash: string; reason: string }[];
}

export interface ScanLookupResponse {
  allowed: boolean;
  reason: string;
  participant: {
    firstName: string;
    lastName: string;
    teamName: string | null;
    participantType: string | null;
    hasActivePass: boolean;
    checkedOutAt: string | null;
    servedMealCount: number;
  } | null;
}

export type VerdictKind = 'ok' | 'already' | 'ko' | 'unknown' | 'expired' | 'offline';

export interface Verdict {
  kind: VerdictKind;
  title: string;
  detail: string;
  /** Compteur de service (direction C) après ce scan, si applicable. */
  servedCount?: number;
  firstName?: string;
  lastName?: string;
}

/** Évalue un scan contre la table locale. Hash calculé en amont (crypto async). */
export function evaluateScan(
  row: ScanTableRow | undefined,
  scanType: ScanTypeCode,
  point: ScanPointConfig,
  alreadyScannedHashes: ReadonlySet<string>,
): Verdict {
  if (!row) {
    return { kind: 'unknown', title: 'Badge inconnu', detail: 'Vérifiez le badge avec un référent.' };
  }
  if (row.checkedOutAt) {
    return { kind: 'ko', title: 'Sortie déjà enregistrée', detail: `${row.firstName} ${row.lastName} a quitté l'événement.` };
  }
  if (row.badgeStatus !== 'ACTIVE' || !row.hasActivePass) {
    return { kind: 'ko', title: 'Badge inactif', detail: `${row.firstName} ${row.lastName} — badge perdu ou remplacé.` };
  }
  if (scanType === 'ENTRY' && alreadyScannedHashes.has(row.qrCodeHash)) {
    const count = point.type === 'MEAL' || point.type === 'BUS' ? row.servedMealCount : undefined;
    return {
      kind: 'already',
      title: 'Déjà validé',
      detail: `${row.firstName} ${row.lastName} a déjà été validé ici aujourd'hui.`,
      servedCount: count,
    };
  }
  const counted = point.type === 'MEAL' || point.type === 'BUS';
  return {
    kind: 'ok',
    title: scanType === 'EXIT' ? 'Sortie enregistrée' : 'OK',
    detail: `${row.firstName} ${row.lastName}${row.teamName ? ` · ${row.teamName}` : ''}`,
    servedCount: counted ? row.servedMealCount + 1 : undefined,
    firstName: row.firstName,
    lastName: row.lastName,
  };
}
