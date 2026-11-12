import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MejAgeGroup, ParticipantSex } from '../entities';

export type RepartitionAgeMode = 'tranches' | 'same-age' | 'mixed';
export type RepartitionSexMode = 'balanced' | 'none' | 'non-mixed';
export type RepartitionGeoGranularity = 'group' | 'city' | 'diocese';

// ── Étape 1 : pool de participants (jeunes + animateurs) ────────────────────

export class RepartitionParticipantsQueryDto {
  @ApiPropertyOptional({ description: 'Recherche libre (prénom ; nom aussi pour les animateurs)' })
  search?: string;

  @ApiPropertyOptional({ enum: ['all', 'JEUNE', 'ANIMATEUR'], description: 'Type de participant' })
  type?: 'all' | 'JEUNE' | 'ANIMATEUR';

  @ApiPropertyOptional({ enum: MejAgeGroup, description: 'Tranche d’âge MEJ' })
  ageGroup?: MejAgeGroup;

  @ApiPropertyOptional({ enum: ParticipantSex, description: 'Sexe' })
  sex?: ParticipantSex;

  @ApiPropertyOptional({ description: 'Filtre par groupe d’origine' })
  groupId?: number;

  @ApiPropertyOptional({ description: 'Filtre par ville' })
  city?: string;

  @ApiPropertyOptional({ description: 'Filtre par diocèse' })
  diocese?: string;

  @ApiPropertyOptional({ enum: ['all', 'unassigned', 'assigned'], description: 'Affectation actuelle' })
  assignment?: 'all' | 'unassigned' | 'assigned';

  @ApiPropertyOptional({ description: 'Taille de page (défaut 100, max 1000)' })
  limit?: number;

  @ApiPropertyOptional({ description: 'Décalage de pagination (défaut 0)' })
  offset?: number;
}

/**
 * Un participant (jeune ou animateur) pour la page de répartition.
 * Confidentialité des mineurs : pour un JEUNE, lastName vaut toujours null et
 * aucune coordonnée n'est renvoyée — seuls prénom, âge, sexe et origine.
 */
export interface RepartitionParticipantRow {
  id: number;
  type: 'JEUNE' | 'ANIMATEUR';
  firstName: string;
  /** Nom de famille : uniquement pour les animateurs (adultes). */
  lastName: string | null;
  /** Âge calculé à la date du jour, null si date de naissance inconnue. */
  age: number | null;
  sex: ParticipantSex | null;
  mejAgeGroup: MejAgeGroup | null;
  groupId: number | null;
  groupName: string | null;
  city: string | null;
  diocese: string | null;
  teamId: number | null;
  teamName: string | null;
}

export interface RepartitionParticipantsResult {
  total: number;
  participants: RepartitionParticipantRow[];
}

/** Listes de valeurs pour les filtres de l'étape 1. */
export interface JeunesRepartitionFilters {
  groups: { id: number; name: string }[];
  cities: string[];
  dioceses: string[];
  ageGroups: MejAgeGroup[];
}

// ── Étape 2 : équipes ────────────────────────────────────────────────────────

export class RepartitionJeunesTeamsQueryDto {
  @ApiPropertyOptional({ description: 'Recherche libre sur le nom de l’équipe' })
  search?: string;

  @ApiPropertyOptional({ description: 'Filtre par groupe de rassemblement' })
  groupId?: number;

  @ApiPropertyOptional({ enum: ['all', 'free', 'full'], description: 'Remplissage' })
  fill?: 'all' | 'free' | 'full';
}

export class BulkCreateTeamsDto {
  @ApiProperty({ example: 8, minimum: 1, maximum: 100 })
  count!: number;

  @ApiPropertyOptional({ example: 'Équipe', default: 'Équipe' })
  baseName?: string;

  @ApiPropertyOptional({ example: 12, minimum: 1, default: 12 })
  maxSize?: number;
}

export interface BulkCreateTeamsResult {
  created: { id: number; name: string; maxSize: number }[];
}

// ── Étape 3 : proposition automatique ───────────────────────────────────────

export class RepartitionParamsDto {
  @ApiPropertyOptional({ example: 6, default: 6, description: 'Jeunes par équipe (cible)' })
  jeunesPerTeam?: number;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Adultes (animateurs) par équipe' })
  adultsPerTeam?: number;

  @ApiPropertyOptional({ enum: ['tranches', 'same-age', 'mixed'], default: 'mixed' })
  ageMode?: RepartitionAgeMode;

  @ApiPropertyOptional({ enum: ['balanced', 'none', 'non-mixed'], default: 'balanced' })
  sexMode?: RepartitionSexMode;

  @ApiPropertyOptional({ enum: ['group', 'city', 'diocese'], default: 'group' })
  geoGranularity?: RepartitionGeoGranularity;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Jeunes max de la même origine par équipe' })
  geoMaxPerTeam?: number;

  @ApiPropertyOptional({ default: true, description: 'Écarter un animateur des jeunes de son groupe d’origine' })
  separateAnimators?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Autoriser le déplacement des jeunes déjà affectés' })
  moveAssigned?: boolean;
}

export class ProposeRepartitionDto {
  @ApiProperty({ type: [Number] })
  participantIds!: number[];

  @ApiProperty({ type: [Number] })
  teamIds!: number[];

  @ApiPropertyOptional({ type: RepartitionParamsDto })
  params?: RepartitionParamsDto;
}

export interface ProposalViolation {
  teamId: number | null;
  participantId: number | null;
  kind: 'geo' | 'animator-origin' | 'capacity';
  message: string;
}

export interface ProposalTeamStat {
  teamId: number;
  jeunes: number;
  adultes: number;
  maxSize: number;
  sexes: Record<string, number>;
  tranches: Record<string, number>;
  origins: Record<string, number>;
}

export interface ProposeRepartitionResult {
  proposals: { participantId: number; teamId: number }[];
  unplaced: number[];
  violations: ProposalViolation[];
  teamStats: ProposalTeamStat[];
}

// ── Étape 3 : application ────────────────────────────────────────────────────

export class ApplyJeunesRepartitionEntryDto {
  @ApiProperty({ example: 501 })
  participantId!: number;

  @ApiProperty({ example: 7, nullable: true, description: 'Équipe cible, null = retirer de son équipe' })
  teamId!: number | null;
}

export class ApplyJeunesRepartitionDto {
  @ApiProperty({ type: [ApplyJeunesRepartitionEntryDto] })
  assignments!: ApplyJeunesRepartitionEntryDto[];
}

export interface ApplyJeunesRepartitionResult {
  applied: number;
}
