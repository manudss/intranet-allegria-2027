import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { GatheringGroupCategory } from '../entities';

export class CreateRepartitionDto {
  @ApiProperty({ example: 'Repas du soir J1' })
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ example: 12, nullable: true, description: 'Événement de l\'agenda rattaché ; vide = répartition autonome.' })
  @IsOptional()
  @IsInt()
  programSequenceId?: number | null;

  @ApiPropertyOptional({ example: 'Groupes calqués sur les lieux de restauration.', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateRepartitionDto extends PartialType(CreateRepartitionDto) {
  @ApiPropertyOptional({ description: 'Comptage des jauges : animateurs compris (défaut) ou non. Paramétrable.' })
  @IsOptional()
  @IsBoolean()
  countAnimators?: boolean;
}

export class SetOverflowDto {
  @ApiProperty({
    example: true,
    description:
      'Dérogation au dépassement bloquant, réservée au niveau Gérer : acte explicite, par répartition.',
  })
  @IsBoolean()
  allowOverflow!: boolean;
}

export class CreateGroupDto {
  @ApiProperty({ example: 'Groupe A' })
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ enum: GatheringGroupCategory, example: 'MIXTE' })
  @IsOptional()
  @IsEnum(GatheringGroupCategory)
  category?: GatheringGroupCategory;

  @ApiPropertyOptional({ example: 200, nullable: true, description: 'Capacité en personnes ; vide = sans jauge.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacityPersons?: number | null;

  @ApiPropertyOptional({ example: 'Gymnase', nullable: true, description: 'Lieu en texte libre.' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  location?: string | null;

  @ApiPropertyOptional({ example: 3, nullable: true, description: "Groupe d'hébergement lié." })
  @IsOptional()
  @IsInt()
  hostingGroupId?: number | null;

  @ApiPropertyOptional({ example: 8, nullable: true, description: 'Fiche de poste (document) liée.' })
  @IsOptional()
  @IsInt()
  documentLinkId?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}

export class SetManagersDto {
  @ApiProperty({ type: [Number], example: [4, 9], description: 'Comptes responsables du groupe (périmètre « ses groupes »).' })
  @IsArray()
  @IsInt({ each: true })
  userIds!: number[];
}

export class ApplyAssignmentItemDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  teamId!: number;

  @ApiProperty({ example: 3, nullable: true, description: 'null = retirer de la répartition.' })
  @IsInt()
  @IsOptional()
  groupId!: number | null;
}

export class ApplyAssignmentsDto {
  @ApiProperty({
    type: 'array',
    example: [{ teamId: 12, groupId: 3 }],
    description: 'Affectations à enregistrer en une transaction ; groupId null = retirer de la répartition.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ApplyAssignmentItemDto)
  assignments!: ApplyAssignmentItemDto[];
}
