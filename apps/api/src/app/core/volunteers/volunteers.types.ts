import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateVolunteerDto {
  @ApiPropertyOptional({ example: 10, nullable: true })
  userId?: number | null;

  @ApiProperty({ example: 'Paul' })
  firstName!: string;

  @ApiProperty({ example: 'Martin' })
  lastName!: string;

  @ApiPropertyOptional({ example: '+33611223344' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'paul.martin@example.org' })
  email?: string | null;

  @ApiPropertyOptional({ example: 'Animation liturgie' })
  team?: string | null;

  @ApiPropertyOptional({ example: false })
  isGroupLeader?: boolean;

  @ApiPropertyOptional({ example: 'Disponible pour transports de nuit.' })
  notes?: string | null;
}

export class UpdateVolunteerDto extends PartialType(CreateVolunteerDto) {}
