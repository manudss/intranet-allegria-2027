import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateGroupDto {
  @ApiProperty({ example: 'Groupe Lyon Nord' })
  name!: string;

  @ApiPropertyOptional({ example: 'Lyon' })
  diocese?: string | null;

  @ApiPropertyOptional({ example: '2027-07-19T08:00:00.000Z', nullable: true })
  arrivalDatetime?: string | null;

  @ApiPropertyOptional({ example: '2027-07-27T18:00:00.000Z', nullable: true })
  departureDatetime?: string | null;

  @ApiPropertyOptional({ example: 'Arrivee en train, besoin navette.' })
  notes?: string | null;
}

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}


