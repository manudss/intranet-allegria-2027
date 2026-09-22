import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { VolunteerMissionStatus, VolunteerShiftStatus } from '../entities';

export class FindVolunteerMissionsQueryDto {
  @ApiPropertyOptional({ example: 2 })
  volunteerTeamId?: number;

  @ApiPropertyOptional({ example: 'Gymnase Saint-Pierre' })
  location?: string;

  @ApiPropertyOptional({ example: '2027-07-24' })
  date?: string;

  @ApiPropertyOptional({ enum: VolunteerMissionStatus })
  status?: VolunteerMissionStatus;
}

export class DayViewQueryDto {
  @ApiPropertyOptional({ example: '2027-07-24' })
  date?: string;
}

export class CreateVolunteerMissionDto {
  @ApiProperty({ example: 'Accueil des groupes - Porte Ouest' })
  title!: string;

  @ApiPropertyOptional({ example: 'Coordonner l arrivee des cars entre 8h et 11h', nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  volunteerTeamId?: number | null;

  @ApiPropertyOptional({ example: 'Porte Ouest', nullable: true })
  location?: string | null;

  @ApiPropertyOptional({ example: 12, nullable: true })
  responsibleVolunteerId?: number | null;

  @ApiPropertyOptional({ enum: VolunteerMissionStatus, default: VolunteerMissionStatus.DRAFT })
  status?: VolunteerMissionStatus;

  @ApiPropertyOptional({ default: false })
  isOptional?: boolean;
}

export class UpdateVolunteerMissionDto extends PartialType(CreateVolunteerMissionDto) {}

export class ChangeVolunteerMissionStatusDto {
  @ApiProperty({ enum: VolunteerMissionStatus })
  status!: VolunteerMissionStatus;

  @ApiPropertyOptional({ nullable: true })
  reason?: string | null;

  @ApiPropertyOptional({ default: false })
  force?: boolean;
}

export class CreateVolunteerShiftDto {
  @ApiProperty({ example: '2027-07-24T08:00:00.000Z' })
  startAt!: string;

  @ApiProperty({ example: '2027-07-24T12:00:00.000Z' })
  endAt!: string;

  @ApiPropertyOptional({ example: 'Porte Ouest', nullable: true })
  location?: string | null;

  @ApiPropertyOptional({ example: 8, nullable: true })
  capacity?: number | null;

  @ApiPropertyOptional({ enum: VolunteerShiftStatus, default: VolunteerShiftStatus.TODO })
  status?: VolunteerShiftStatus;

  @ApiPropertyOptional({ default: false })
  isOptional?: boolean;

  @ApiPropertyOptional({ example: 'Prevoir badge accueil', nullable: true })
  notes?: string | null;
}

export class UpdateVolunteerShiftDto extends PartialType(CreateVolunteerShiftDto) {}

export class ChangeVolunteerShiftStatusDto {
  @ApiProperty({ enum: VolunteerShiftStatus })
  status!: VolunteerShiftStatus;

  @ApiPropertyOptional({ nullable: true })
  reason?: string | null;

  @ApiPropertyOptional({ default: false })
  force?: boolean;
}
