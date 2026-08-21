import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateVolunteerTeamDto {
  @ApiProperty({ example: 'Animation liturgie' })
  name!: string;

  @ApiProperty({ example: 'ANIMATION_LITURGIE' })
  code!: string;

  @ApiPropertyOptional({ example: 'Equipe en charge des celebrations et services.' })
  description?: string | null;

  @ApiPropertyOptional({ example: true })
  isActive?: boolean;
}

export class UpdateVolunteerTeamDto extends PartialType(CreateVolunteerTeamDto) {}

export class CreateVolunteerTeamMembershipDto {
  @ApiProperty({ example: 3 })
  volunteerTeamId!: number;

  @ApiPropertyOptional({ example: '2027-07-19', nullable: true })
  startAt?: string | null;

  @ApiPropertyOptional({ example: '2027-07-27', nullable: true })
  endAt?: string | null;

  @ApiPropertyOptional({ example: 'Responsable de coordination', nullable: true })
  role?: string | null;
}

export class UpdateVolunteerTeamMembershipDto extends PartialType(CreateVolunteerTeamMembershipDto) {}
