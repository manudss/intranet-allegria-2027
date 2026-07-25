import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AssignmentStatus } from '../entities';

export class CreateAssignmentDto {
  @ApiProperty({ example: 501 })
  participantId!: number;

  @ApiProperty({ example: 88 })
  hostFamilyId!: number;

  @ApiProperty({ example: '2027-07-19', description: 'Format ISO date (YYYY-MM-DD)' })
  arrivalDate!: string;

  @ApiProperty({ example: '2027-07-27', description: 'Format ISO date (YYYY-MM-DD)' })
  departureDate!: string;

  @ApiPropertyOptional({ enum: AssignmentStatus, example: AssignmentStatus.CONFIRMED })
  status?: AssignmentStatus;

  @ApiPropertyOptional({ example: 'Preferer chambre avec un camarade du meme groupe.' })
  notes?: string | null;
}

export class UpdateAssignmentDto extends PartialType(CreateAssignmentDto) {}


