import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccommodationType, HostingGroupKind } from '../entities';
import { SexMixingRule, UnplacedReason } from './placement.algorithm';

export class HostingGroupDto {
  @ApiProperty({ example: 'Quartier Croix-Rousse' })
  name!: string;

  @ApiPropertyOptional({ enum: HostingGroupKind, example: 'PARISH', description: 'Type de regroupement : zone géographique, paroisse ou autre.' })
  kind?: HostingGroupKind;

  @ApiPropertyOptional({ example: '#2f7d6d', nullable: true, description: 'Couleur #rrggbb affichée sur la carte.' })
  color?: string | null;

  @ApiPropertyOptional({ example: 'Familles à moins de 15 min du lieu.', nullable: true })
  notes?: string | null;
}

export class BulkAssignFamiliesDto {
  @ApiProperty({ type: [Number], example: [1, 2, 3] })
  familyIds!: number[];

  @ApiProperty({ example: 3, nullable: true, description: 'null pour retirer du groupe' })
  hostingGroupId!: number | null;
}

export class GroupFromParishesDto {
  @ApiPropertyOptional({ type: [String], description: 'Limiter à ces paroisses (défaut : toutes celles qui ont des familles sans groupe).' })
  parishes?: string[];
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
  /** Null pour les fiches BENEVOLE (adultes, hors mixité jeunes). */
  sex: string | null;
  type: string;
  /** Null pour les fiches BENEVOLE (toujours comptées adultes). */
  dateOfBirth: string | null;
  teamId: number;
  assignmentId: number | null;
  hostFamilyId: number | null;
  assignmentStatus: string | null;
}


export interface BoardResponse {
  hostingGroups: { id: number; name: string; notes: string | null; kind: HostingGroupKind; color: string | null }[];
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
    accommodationType: AccommodationType;
    latitude: number | null;
    longitude: number | null;
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
