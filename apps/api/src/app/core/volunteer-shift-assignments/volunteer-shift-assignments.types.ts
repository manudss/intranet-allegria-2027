import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VolunteerShiftAssignmentStatus, VolunteerSkillType } from '../entities';

export class CreateVolunteerShiftAssignmentDto {
  @ApiProperty({ example: 42 })
  volunteerId!: number;

  @ApiPropertyOptional({
    enum: VolunteerShiftAssignmentStatus,
    default: VolunteerShiftAssignmentStatus.PROVISIONAL,
  })
  status?: VolunteerShiftAssignmentStatus;

  @ApiPropertyOptional({ example: 'Renfort accueil bus', nullable: true })
  notes?: string | null;

  @ApiPropertyOptional({ example: false, default: false })
  force?: boolean;
}

export class ChangeVolunteerShiftAssignmentStatusDto {
  @ApiProperty({ enum: VolunteerShiftAssignmentStatus })
  status!: VolunteerShiftAssignmentStatus;

  @ApiPropertyOptional({ example: 'Validation coordinateur', nullable: true })
  notes?: string | null;

  @ApiPropertyOptional({ example: false, default: false })
  force?: boolean;
}

export class CancelVolunteerShiftAssignmentDto {
  @ApiPropertyOptional({ example: 'Le bénévole n est plus disponible', nullable: true })
  notes?: string | null;
}

export class ListShiftAssignmentsQueryDto {
  @ApiPropertyOptional({ enum: VolunteerShiftAssignmentStatus })
  status?: VolunteerShiftAssignmentStatus;
}

export class VolunteerPlanningQueryDto {
  @ApiPropertyOptional({ enum: VolunteerShiftAssignmentStatus })
  status?: VolunteerShiftAssignmentStatus;
}

export class SearchShiftAssignmentVolunteerQueryDto {
  @ApiPropertyOptional({
    example: 88,
    description: 'Si fourni, startAt/endAt sont derives du shift',
  })
  shiftId?: number;

  @ApiPropertyOptional({ example: 'Paul Martin' })
  q?: string;

  @ApiPropertyOptional({ enum: VolunteerSkillType })
  skill?: VolunteerSkillType;

  @ApiPropertyOptional({ example: 'musique' })
  tag?: string;

  @ApiPropertyOptional({ example: 3 })
  volunteerTeamId?: number;

  @ApiPropertyOptional({ example: true, default: false })
  availableOnly?: boolean;

  @ApiPropertyOptional({ example: '2027-07-24T08:00:00.000Z' })
  startAt?: string;

  @ApiPropertyOptional({ example: '2027-07-24T12:00:00.000Z' })
  endAt?: string;
}
