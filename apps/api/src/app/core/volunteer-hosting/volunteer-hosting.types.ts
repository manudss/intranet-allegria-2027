import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateVolunteerHostingDto {
  @ApiProperty({ example: 12 })
  volunteerId!: number;

  @ApiProperty({ example: 45, description: 'Équipe (de jeunes) avec laquelle le bénévole dort' })
  teamId!: number;

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

/** Vue /me/hosting : équipe rattachée, animateurs, jeunes (prénoms seulement), hébergements. */
export interface VolunteerLodgingView {
  id: number;
  room: string | null;
  notes: string | null;
  startAt: string | null;
  endAt: string | null;
  team: { id: number; name: string };
  animators: { id: number; firstName: string; lastName: string; role: 'PRIMARY' | 'SECONDARY'; phone: string | null }[];
  youths: { firstName: string }[];
  hostFamilies: {
    id: number;
    familyName: string;
    address: string;
    postalCode: string;
    city: string;
    phone: string | null;
  }[];
}
