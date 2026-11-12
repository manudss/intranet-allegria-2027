import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { VolunteerHostingType } from '../entities';

export class CreateVolunteerHostingDto {
  @ApiProperty({ example: 12 })
  volunteerId!: number;

  @ApiProperty({ enum: VolunteerHostingType, example: VolunteerHostingType.HOST_FAMILY })
  type!: VolunteerHostingType;

  @ApiPropertyOptional({ example: 34, nullable: true })
  hostFamilyId?: number | null;

  @ApiPropertyOptional({ example: 'Gymnase Jean-Paul II', nullable: true })
  locationName?: string | null;

  @ApiPropertyOptional({ example: '12 rue des Tilleuls, 69003 Lyon', nullable: true })
  address?: string | null;

  @ApiPropertyOptional({ example: 'Dortoir B', nullable: true })
  room?: string | null;

  @ApiPropertyOptional({ example: 'Arrivée possible dès le jeudi soir.', nullable: true })
  notes?: string | null;

  @ApiPropertyOptional({ example: '2027-10-31', nullable: true })
  startAt?: string | null;

  @ApiPropertyOptional({ example: '2027-11-03', nullable: true })
  endAt?: string | null;
}

export class UpdateVolunteerHostingDto extends PartialType(CreateVolunteerHostingDto) {}
