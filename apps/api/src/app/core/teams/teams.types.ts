import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateTeamDto {
  @ApiProperty({ example: 'Equipe Saint Luc 01' })
  name!: string;

  @ApiPropertyOptional({ example: 3, nullable: true })
  groupId?: number | null;

  @ApiPropertyOptional({ example: 42, nullable: true })
  primaryAnimatorId?: number | null;

  @ApiPropertyOptional({ example: 43, nullable: true })
  secondaryAnimatorId?: number | null;

  @ApiPropertyOptional({ example: 10, minimum: 1 })
  maxSize?: number;

  @ApiPropertyOptional({ example: 'Equipe calme, prefere ateliers logistiques.' })
  notes?: string | null;
}

export class UpdateTeamDto extends PartialType(CreateTeamDto) {}


