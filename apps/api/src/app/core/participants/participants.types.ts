import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { MejAgeGroup, ParticipantSex, PersonType } from '../entities';

export class CreateParticipantDto {
  @ApiProperty({ example: 'Marie' })
  firstName!: string;

  @ApiProperty({ example: 'Durand' })
  lastName!: string;

  @ApiProperty({ example: '2011-03-19', description: 'Format ISO date (YYYY-MM-DD)' })
  dateOfBirth!: string;

  @ApiProperty({ enum: ParticipantSex, example: ParticipantSex.FEMALE })
  sex!: ParticipantSex;

  @ApiProperty({ enum: MejAgeGroup, example: MejAgeGroup.TA })
  mejAgeGroup!: MejAgeGroup;

  @ApiPropertyOptional({ enum: PersonType, default: PersonType.JEUNE })
  type?: PersonType;

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

export class SearchParticipantsQuery {
  @ApiPropertyOptional({ type: Boolean }) unassignedOnly?: boolean | string;
  @ApiPropertyOptional({ enum: PersonType }) type?: PersonType;
  @ApiPropertyOptional({ type: Number }) teamId?: number | string;
  @ApiPropertyOptional() q?: string;
  @ApiPropertyOptional({ default: 20, maximum: 100 }) limit?: number | string;
  @ApiPropertyOptional({ default: 0 }) offset?: number | string;
}


