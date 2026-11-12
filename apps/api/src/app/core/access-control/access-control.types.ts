import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AccessBadgeStatus,
  AccessScanDuplicateRule,
  AccessScanVerdict,
  PersonType,
} from '../entities';

export class RegisterBadgeStockDto {
  @ApiProperty({ example: 'L2027-A' })
  lot!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['9f2c1e0a4b6d8f3012345678'],
    description: 'Codes déjà imprimés à enregistrer. Sinon, count codes opaques sont générés.',
  })
  codes?: string[];

  @ApiPropertyOptional({ example: 100, description: 'Nombre de codes opaques à générer pour le lot.' })
  count?: number;
}

export class AssignBadgeDto {
  @ApiProperty({ example: 42 })
  participantId!: number;

  @ApiPropertyOptional({ example: '9f2c1e0a4b6d8f3012345678' })
  badgeCode?: string;

  @ApiPropertyOptional({ example: 12 })
  badgeId?: number;

  @ApiPropertyOptional({ example: 'Attribution à l’accueil' })
  reason?: string;

  @ApiPropertyOptional({ example: 'op-2027-07-31-0001', description: 'Idempotence de la demande.' })
  operationId?: string;
}

export class ReplaceBadgeDto {
  @ApiProperty({ example: 42 })
  participantId!: number;

  @ApiProperty({ example: 'ab12cd34ef56ab78cd34ef56', description: 'Code du badge neuf (disponible).' })
  newBadgeCode!: string;

  @ApiPropertyOptional({ example: 'Badge perdu' })
  reason?: string;

  @ApiPropertyOptional({ example: 'op-2027-07-31-0002' })
  operationId?: string;
}

export class RevokeBadgeDto {
  @ApiPropertyOptional({ example: 'Fin de séjour' })
  reason?: string;
}

export class ListBadgesQueryDto {
  @ApiPropertyOptional({ enum: AccessBadgeStatus })
  status?: AccessBadgeStatus;

  @ApiPropertyOptional({ example: 'L2027-A' })
  lot?: string;

  @ApiPropertyOptional({ example: '9f2c' })
  q?: string;

  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 200 })
  limit?: number | string;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  offset?: number | string;
}

export class CreateScanTypeDto {
  @ApiProperty({ example: 'MEAL' })
  code!: string;

  @ApiProperty({ example: 'Repas' })
  label!: string;

  @ApiPropertyOptional({ example: 'Un seul passage par service.' })
  description?: string;

  @ApiPropertyOptional({ enum: AccessScanDuplicateRule, example: AccessScanDuplicateRule.UNIQUE_PER_SERVICE })
  duplicateRule?: AccessScanDuplicateRule;
}

export class CreateZoneDto {
  @ApiProperty({ example: 'Salle plénière' })
  name!: string;

  @ApiPropertyOptional({ example: 'Zone sensible, bénévoles uniquement.' })
  description?: string;

  @ApiPropertyOptional({ enum: PersonType, isArray: true, example: [PersonType.BENEVOLE, PersonType.ANIMATEUR] })
  allowedPersonTypes?: PersonType[];

  @ApiPropertyOptional({ example: false })
  requiresOnlineValidation?: boolean;

  @ApiPropertyOptional({ example: 240 })
  maxOfflineMinutes?: number;
}

export class CreateScanPointDto {
  @ApiProperty({ example: 1 })
  zoneId!: number;

  @ApiProperty({ example: 2 })
  scanTypeId!: number;

  @ApiProperty({ example: 'Porte A' })
  name!: string;

  @ApiPropertyOptional({ example: 'repas-2027-07-31-midi' })
  serviceKey?: string;
}

export class CreateScannerGrantDto {
  @ApiProperty({ example: 12 })
  userId!: number;

  @ApiPropertyOptional({ example: 1, description: 'Zone limitée ; absent = toutes zones.' })
  zoneId?: number;

  @ApiPropertyOptional({ example: '2027-07-31T06:00:00.000Z' })
  startsAt?: string;

  @ApiPropertyOptional({ example: '2027-08-04T20:00:00.000Z' })
  endsAt?: string;
}

export class StartScanSessionDto {
  @ApiPropertyOptional({ example: 1, description: 'Zone couverte ; absent = toutes les zones du grant.' })
  zoneId?: number;
}

export class ScanBatchItemDto {
  @ApiProperty({ example: 'evt-2027-07-31-000045' })
  clientEventId!: string;

  @ApiProperty({ example: '9f2c1e0a4b6d8f3012345678' })
  code!: string;

  @ApiProperty({ example: 3 })
  pointId!: number;

  @ApiPropertyOptional({ example: 128, description: 'Affectation connue de la table locale, si présente.' })
  assignmentId?: number;

  @ApiPropertyOptional({ example: 41 })
  tableVersion?: number;

  @ApiPropertyOptional({ example: '2027-07-31T12:03:11.000Z' })
  occurredAtLocal?: string;

  @ApiPropertyOptional({ example: 'repas-2027-07-31-midi' })
  serviceKey?: string;
}

export class UploadScansDto {
  @ApiProperty({ type: [ScanBatchItemDto] })
  scans!: ScanBatchItemDto[];
}

export class LookupCodeDto {
  @ApiProperty({ example: '9f2c1e0a4b6d8f3012345678' })
  code!: string;

  @ApiProperty({ example: 3 })
  pointId!: number;
}

/** Ligne d'instantané : le minimum utile au verdict, pas de donnée sensible. */
export type SnapshotEntry = {
  assignmentId: number;
  code: string;
  firstName: string;
  lastName: string;
  personType: PersonType;
  version: number;
};

export type ScanVerdictResult = {
  clientEventId: string;
  verdict: AccessScanVerdict;
  duplicateOfEventId?: number;
};

export type LookupResult = {
  verdict: AccessScanVerdict;
  /** Nom affiché seulement si la question 9 du plan est tranchée ainsi ; verdict seul par défaut. */
  firstName?: string;
  lastName?: string;
};
