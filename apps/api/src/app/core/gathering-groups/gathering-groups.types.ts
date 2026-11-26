import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { GatheringGroupCategory } from '../entities';

export class CreateRepartitionDto {
  @ApiProperty({ example: 'Repas du soir J1' })
  name!: string;

  @ApiPropertyOptional({ example: 12, nullable: true, description: 'Événement de l\'agenda rattaché ; vide = répartition autonome.' })
  programSequenceId?: number | null;

  @ApiPropertyOptional({ example: 'Groupes calqués sur les lieux de restauration.', nullable: true })
  notes?: string | null;
}

export class UpdateRepartitionDto extends PartialType(CreateRepartitionDto) {
  @ApiPropertyOptional({ description: 'Comptage des jauges : animateurs compris (défaut) ou non. Paramétrable.' })
  countAnimators?: boolean;
}

export class SetOverflowDto {
  @ApiProperty({
    example: true,
    description:
      'Dérogation au dépassement bloquant, réservée au niveau Gérer : acte explicite, par répartition.',
  })
  allowOverflow!: boolean;
}

export class CreateGroupDto {
  @ApiProperty({ example: 'Groupe A' })
  name!: string;

  @ApiPropertyOptional({ enum: GatheringGroupCategory, example: 'MIXTE' })
  category?: GatheringGroupCategory;

  @ApiPropertyOptional({ example: 200, nullable: true, description: 'Capacité en personnes ; vide = sans jauge.' })
  capacityPersons?: number | null;

  @ApiPropertyOptional({ example: 'Gymnase', nullable: true, description: 'Lieu en texte libre.' })
  location?: string | null;

  @ApiPropertyOptional({ example: 3, nullable: true, description: "Groupe d'hébergement lié." })
  hostingGroupId?: number | null;

  @ApiPropertyOptional({ example: 8, nullable: true, description: 'Fiche de poste (document) liée.' })
  documentLinkId?: number | null;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;
}

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}

export class SetManagersDto {
  @ApiProperty({ type: [Number], example: [4, 9], description: 'Comptes responsables du groupe (périmètre « ses groupes »).' })
  userIds!: number[];
}

export class ApplyAssignmentsDto {
  @ApiProperty({
    type: 'array',
    example: [{ teamId: 12, groupId: 3 }],
    description: 'Affectations à enregistrer en une transaction ; groupId null = retirer de la répartition.',
  })
  assignments!: { teamId: number; groupId: number | null }[];
}
