import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SexMixingRule, UnplacedReason } from './placement.algorithm';

export class HostingGroupDto {
  @ApiProperty({ example: 'Quartier Croix-Rousse' })
  name!: string;

  @ApiPropertyOptional({ example: 'Familles à moins de 15 min du lieu.', nullable: true })
  notes?: string | null;
}

export class AssignToGroupDto {
  @ApiProperty({ example: 3, nullable: true, description: 'null pour retirer du groupe' })
  hostingGroupId!: number | null;
}

export class PlacementRulesDto {
  @ApiPropertyOptional({ example: true })
  countAnimatorsInCapacity?: boolean;

  @ApiPropertyOptional({ enum: ['ignore', 'avoid', 'forbid'], example: 'ignore' })
  sexMixing?: SexMixingRule;
}

export class PlaceParticipantDto {
  @ApiProperty({ example: 501 })
  participantId!: number;

  @ApiProperty({ example: 88 })
  hostFamilyId!: number;

  @ApiPropertyOptional({ example: '2027-10-30', description: 'ISO. Par défaut : séjour déjà enregistré, puis dates du groupe.' })
  arrivalDate?: string;

  @ApiPropertyOptional({ example: '2027-11-02' })
  departureDate?: string;

  @ApiPropertyOptional({ description: 'Autorise le déplacement d’une affectation existante vers une autre famille.' })
  replaceExisting?: boolean;

  @ApiPropertyOptional({ type: PlacementRulesDto })
  rules?: PlacementRulesDto;
}

export class AutoPlaceDto {
  @ApiProperty({ example: '2027-10-30' })
  arrivalDate!: string;

  @ApiProperty({ example: '2027-11-02' })
  departureDate!: string;

  @ApiPropertyOptional({ type: [Number], description: 'Limiter à ces équipes du groupe.' })
  teamIds?: number[];

  @ApiPropertyOptional({ description: 'false (défaut) : aperçu seulement. true : enregistre les affectations PENDING.' })
  apply?: boolean;

  @ApiPropertyOptional({ type: PlacementRulesDto })
  rules?: PlacementRulesDto;
}

export interface BoardMember {
  participantId: number;
  firstName: string;
  lastName: string;
  sex: string;
  type: string;
  dateOfBirth: string;
  teamId: number;
  assignmentId: number | null;
  hostFamilyId: number | null;
  assignmentStatus: string | null;
}

export interface BoardResponse {
  hostingGroups: { id: number; name: string; notes: string | null }[];
  teams: {
    id: number;
    name: string;
    groupName: string | null;
    hostingGroupId: number | null;
    memberCount: number;
  }[];
  members: BoardMember[];
  families: {
    id: number;
    familyName: string;
    city: string;
    parish: string | null;
    maxCapacity: number;
    maxUnder18: number;
    maxAnimators: number | null;
    status: string;
    hostingGroupId: number | null;
    constraints: string[];
    tags: string[];
  }[];
  /** Jeunes déjà placés dans une famille qui n'est pas dans le groupe d'hébergement de leur équipe. */
  conflicts: { participantId: number; teamId: number; hostFamilyId: number; reason: string }[];
}

export interface AutoPlaceResponse {
  applied: boolean;
  proposals: { participantId: number; hostFamilyId: number; needsReview: boolean }[];
  unplaced: { participantId: number; reason: UnplacedReason }[];
}
