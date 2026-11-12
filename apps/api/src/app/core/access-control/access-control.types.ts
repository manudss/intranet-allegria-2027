import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  AccessBadgeStatus,
  AccessScanDuplicateRule,
  AccessScanVerdict,
  PersonType,
} from '../entities';

export class RegisterBadgeStockDto {
  @ApiProperty({ example: 'L2027-A' })
  @IsString()
  @MaxLength(120)
  @IsNotEmpty()
  lot!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['9f2c1e0a4b6d8f3012345678'],
    description: 'Codes déjà imprimés à enregistrer. Sinon, count codes opaques sont générés.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10000)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @IsNotEmpty({ each: true })
  codes?: string[];

  @ApiPropertyOptional({ example: 100, description: 'Nombre de codes opaques à générer pour le lot.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  count?: number;
}

export class AssignBadgeDto {
  @ApiProperty({ example: 42 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  participantId!: number;

  @ApiPropertyOptional({ example: '9f2c1e0a4b6d8f3012345678' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  badgeCode?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  badgeId?: number;

  @ApiPropertyOptional({ example: 'Attribution à l’accueil' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  @ApiPropertyOptional({ example: 'op-2027-07-31-0001', description: 'Idempotence de la demande.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  operationId?: string;
}

export class ReplaceBadgeDto {
  @ApiProperty({ example: 42 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  participantId!: number;

  @ApiProperty({ example: 'ab12cd34ef56ab78cd34ef56', description: 'Code du badge neuf (disponible).' })
  @IsString()
  @MaxLength(64)
  @IsNotEmpty()
  newBadgeCode!: string;

  @ApiPropertyOptional({ example: 'Badge perdu' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  @ApiPropertyOptional({ example: 'op-2027-07-31-0002' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  operationId?: string;
}

export class RevokeBadgeDto {
  @ApiPropertyOptional({ example: 'Fin de séjour' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ListBadgesQueryDto {
  @ApiPropertyOptional({ enum: AccessBadgeStatus })
  @IsOptional()
  @IsEnum(AccessBadgeStatus)
  status?: AccessBadgeStatus;

  @ApiPropertyOptional({ example: 'L2027-A' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lot?: string;

  @ApiPropertyOptional({ example: '9f2c' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number | string;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number | string;
}

export class CreateScanTypeDto {
  @ApiProperty({ example: 'MEAL' })
  @IsString()
  @MaxLength(80)
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Repas' })
  @IsString()
  @MaxLength(120)
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({ example: 'Un seul passage par service.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({ enum: AccessScanDuplicateRule, example: AccessScanDuplicateRule.UNIQUE_PER_SERVICE })
  @IsOptional()
  @IsEnum(AccessScanDuplicateRule)
  duplicateRule?: AccessScanDuplicateRule;
}

export class CreateZoneDto {
  @ApiProperty({ example: 'Salle plénière' })
  @IsString()
  @MaxLength(120)
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Zone sensible, bénévoles uniquement.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({ enum: PersonType, isArray: true, example: [PersonType.BENEVOLE, PersonType.ANIMATEUR] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsEnum(PersonType, { each: true })
  allowedPersonTypes?: PersonType[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requiresOnlineValidation?: boolean;

  @ApiPropertyOptional({ example: 240 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  maxOfflineMinutes?: number;
}

export class UpdateZoneDto extends PartialType(CreateZoneDto) {}

export class CreateScanPointDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  zoneId!: number;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scanTypeId!: number;

  @ApiProperty({ example: 'Porte A' })
  @IsString()
  @MaxLength(120)
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'repas-2027-07-31-midi' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  serviceKey?: string;
}

export class CreateScannerGrantDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;

  @ApiPropertyOptional({ example: 1, description: 'Zone limitée ; absent = toutes zones.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  zoneId?: number;

  @ApiPropertyOptional({ example: '2027-07-31T06:00:00.000Z' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @IsISO8601({ strict: true })
  startsAt?: string;

  @ApiPropertyOptional({ example: '2027-08-04T20:00:00.000Z' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @IsISO8601({ strict: true })
  endsAt?: string;
}

export class StartScanSessionDto {
  @ApiPropertyOptional({ example: 1, description: 'Zone couverte ; absent = toutes les zones du grant.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  zoneId?: number;
}

export class ScanBatchItemDto {
  @IsOptional()
  @IsBoolean()
  clientAccepted?: boolean;

  @ApiProperty({ example: 'evt-2027-07-31-000045' })
  @IsString()
  @MaxLength(80)
  @IsNotEmpty()
  clientEventId!: string;

  @ApiProperty({ example: '9f2c1e0a4b6d8f3012345678' })
  @IsString()
  @MaxLength(64)
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pointId!: number;

  @ApiPropertyOptional({ example: 128, description: 'Affectation connue de la table locale, si présente.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignmentId?: number;

  @ApiPropertyOptional({ example: 41 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tableVersion?: number;

  @ApiPropertyOptional({ example: '2027-07-31T12:03:11.000Z' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @IsISO8601({ strict: true })
  occurredAtLocal?: string;

  @ApiPropertyOptional({ example: 'repas-2027-07-31-midi' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  serviceKey?: string;
}

export class UploadScansDto {
  @ApiProperty({ type: [ScanBatchItemDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScanBatchItemDto)
  scans!: ScanBatchItemDto[];
}

export class LookupCodeDto {
  @ApiProperty({ example: '9f2c1e0a4b6d8f3012345678' })
  @IsString()
  @MaxLength(64)
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
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

export class UpdateScanPointDto {
  @IsBoolean()
  active!: boolean;
}
