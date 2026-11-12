import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignBenevoleDto {
  @ApiProperty({ example: 42 })
  volunteerId!: number;

  @ApiPropertyOptional({ example: 'Cuisine du samedi soir, rejoint l équipe pour dormir.' })
  notes?: string | null;
}

/** Affectation d'un bénévole à une équipe de rassemblement, en tant qu'adulte. */
export interface BenevoleAssignment {
  volunteerId: number;
  /** Fiche participant BENEVOLE créée comme projection du bénévole. */
  participantId: number;
  teamId: number;
  teamName: string;
  firstName: string;
  lastName: string;
  /** Pôle/mission déclaré sur la fiche bénévole. */
  mission: string | null;
}

// ── Page de répartition bénévoles → équipes (benevoles/repartition) ──────────

export class RepartitionTeamsQueryDto {
  @ApiPropertyOptional({ description: 'Recherche libre sur le nom de l équipe' })
  search?: string;

  @ApiPropertyOptional({ description: 'Filtre par zone/groupe de logement (hosting group)' })
  hostingGroupId?: number;

  @ApiPropertyOptional({ description: 'Filtre par groupe de rassemblement' })
  groupId?: number;

  @ApiPropertyOptional({ enum: ['all', 'free', 'full'], description: 'Remplissage' })
  fill?: 'all' | 'free' | 'full';
}

export class RepartitionVolunteersQueryDto {
  @ApiPropertyOptional({ description: 'Recherche libre sur nom/prénom' })
  search?: string;

  @ApiPropertyOptional({ description: 'Filtre par compétence' })
  skill?: string;

  @ApiPropertyOptional({ description: 'Filtre par étiquette' })
  tag?: string;

  @ApiPropertyOptional({ description: 'Filtre par pôle (équipe opérationnelle)' })
  poleId?: number;

  @ApiPropertyOptional({ enum: ['all', 'unassigned', 'assigned'], description: 'Affectation actuelle' })
  assignment?: 'all' | 'unassigned' | 'assigned';

  @ApiPropertyOptional({ description: 'Taille de page (défaut 100, max 1000)' })
  limit?: number;

  @ApiPropertyOptional({ description: 'Décalage de pagination (défaut 0)' })
  offset?: number;
}

export class ApplyRepartitionEntryDto {
  @ApiProperty({ example: 42 })
  volunteerId!: number;

  @ApiProperty({ example: 7, nullable: true, description: 'Équipe cible, null = retirer de son équipe' })
  teamId!: number | null;
}

export class ApplyRepartitionDto {
  @ApiProperty({ type: [ApplyRepartitionEntryDto] })
  assignments!: ApplyRepartitionEntryDto[];
}

/** Une équipe de rassemblement, avec son remplissage, pour l'étape 1. */
export interface RepartitionTeamRow {
  id: number;
  name: string;
  groupId: number | null;
  groupName: string | null;
  hostingGroupId: number | null;
  hostingGroupName: string | null;
  jeunes: number;
  adultes: number;
  maxSize: number;
  free: number;
}

/** Un bénévole, avec pôles/compétences/étiquettes et équipe actuelle, pour l'étape 2. */
export interface RepartitionVolunteerRow {
  id: number;
  firstName: string;
  lastName: string;
  mission: string | null;
  poles: string[];
  skills: string[];
  tags: string[];
  teamId: number | null;
  teamName: string | null;
}

export interface RepartitionVolunteersResult {
  total: number;
  volunteers: RepartitionVolunteerRow[];
}

/** Listes de valeurs pour les filtres des étapes 1 et 2. */
export interface RepartitionFilters {
  hostingGroups: { id: number; name: string }[];
  groups: { id: number; name: string }[];
  poles: { id: number; name: string }[];
  tags: string[];
  skills: string[];
}

export interface ApplyRepartitionResult {
  applied: number;
}
