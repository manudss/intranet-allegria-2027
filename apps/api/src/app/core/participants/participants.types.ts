import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ParticipantSex } from '../entities';

export class CreateParticipantDto {
  @ApiProperty({ example: 'Marie' })
  firstName!: string;

  @ApiProperty({ example: 'Durand' })
  lastName!: string;

  @ApiProperty({ example: '2011-03-19', description: 'Format ISO date (YYYY-MM-DD)' })
  dateOfBirth!: string;

  @ApiProperty({ enum: ParticipantSex, example: ParticipantSex.FEMALE })
  sex!: ParticipantSex;

  @ApiPropertyOptional({ example: 'Sophie Durand' })
  emergencyContactName?: string | null;

  @ApiPropertyOptional({ example: '+33601020304' })
  emergencyContactPhone?: string | null;

  @ApiPropertyOptional({ example: 'Lyon' })
  diocese?: string | null;

  @ApiPropertyOptional({ example: 'Villeurbanne' })
  city?: string | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  groupId?: number | null;
}

export class UpdateParticipantDto extends PartialType(CreateParticipantDto) {}


