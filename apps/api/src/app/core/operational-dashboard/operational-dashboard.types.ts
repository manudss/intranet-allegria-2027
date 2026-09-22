import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  VolunteerMissionStatus,
  VolunteerShiftAssignmentStatus,
  VolunteerShiftStatus,
} from '../entities';

// ─── Query DTOs ───────────────────────────────────────────────────────────────

export class DashboardQueryDto {
  @ApiPropertyOptional({
    example: '2027-07-24',
    description: "Date YYYY-MM-DD (défaut : aujourd'hui)",
  })
  date?: string;

  @ApiPropertyOptional({ example: 2, description: 'Filtrer par équipe opérationnelle' })
  volunteerTeamId?: number;
}

export class DashboardWhoDoesWhatQueryDto {
  @ApiPropertyOptional({ example: '2027-07-24' })
  date?: string;

  @ApiPropertyOptional({ example: 2 })
  volunteerTeamId?: number;

  @ApiPropertyOptional({ example: 'Dupont', description: 'Recherche par nom/prénom de bénévole' })
  q?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  limit?: number;
}

export type OperationalExportKind =
  | 'global-planning'
  | 'team-planning'
  | 'volunteer-planning'
  | 'location-planning'
  | 'confirmed-assignments'
  | 'provisional-assignments'
  | 'unfilled-shifts'
  | 'unfinished-missions';

export type OperationalExportFormat = 'xlsx' | 'print' | 'pdf';

export class OperationalExportQueryDto {
  @ApiPropertyOptional({
    example: '2027-07-24',
    description: 'Date YYYY-MM-DD (si dateFrom/dateTo absents)',
  })
  date?: string;

  @ApiPropertyOptional({ example: '2027-07-24', description: 'Début intervalle YYYY-MM-DD' })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2027-07-25', description: 'Fin intervalle YYYY-MM-DD' })
  dateTo?: string;

  @ApiPropertyOptional({ example: 2 })
  volunteerTeamId?: number;

  @ApiPropertyOptional({ example: 12 })
  volunteerId?: number;

  @ApiPropertyOptional({ example: 'Porte Ouest' })
  location?: string;

  @ApiPropertyOptional({ enum: VolunteerMissionStatus })
  missionStatus?: VolunteerMissionStatus;

  @ApiPropertyOptional({ enum: VolunteerShiftStatus })
  shiftStatus?: VolunteerShiftStatus;

  @ApiPropertyOptional({ enum: VolunteerShiftAssignmentStatus })
  assignmentStatus?: VolunteerShiftAssignmentStatus;

  @ApiPropertyOptional({ example: 'xlsx', enum: ['xlsx', 'print', 'pdf'], default: 'xlsx' })
  format?: OperationalExportFormat;
}

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ShiftsByStatus {
  TODO: number;
  ASSIGNED: number;
  IN_PROGRESS: number;
  DONE: number;
  CANCELLED: number;
  NOT_DONE: number;
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface DashboardGlobalSummary {
  date: string;
  missionCount: number;
  shiftCount: number;
  shiftsByStatus: ShiftsByStatus;
  shiftsWithoutConfirmedAssignment: number;
  understaffedShifts: number;
  assignedVolunteers: number;
  provisionalVolunteers: number;
}

export interface DashboardTeamSummary {
  teamId: number;
  teamName: string;
  teamCode: string;
  missionCount: number;
  shiftsByStatus: ShiftsByStatus;
  totalCapacity: number;
  confirmedVolunteers: number;
  provisionalVolunteers: number;
  alerts: string[];
}

export interface DashboardLocationRow {
  location: string;
  shiftsInProgress: number;
  shiftsUpcoming: number;
  assignedVolunteers: number;
  alerts: string[];
}

export interface DashboardWhoDoesWhatShift {
  shiftId: number;
  missionTitle: string;
  missionId: number;
  startAt: string;
  endAt: string;
  location: string | null;
  teamName: string | null;
  assignmentStatus: string;
  shiftStatus: string;
}

export interface DashboardWhoDoesWhatItem {
  volunteerId: number;
  firstName: string;
  lastName: string;
  shifts: DashboardWhoDoesWhatShift[];
}

export interface DashboardWhoDoesWhatResult {
  items: DashboardWhoDoesWhatItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface DashboardTodoMission {
  missionId: number;
  title: string;
  teamName: string | null;
  location: string | null;
  shiftCount: number;
}

export interface DashboardTodoShift {
  shiftId: number;
  missionTitle: string;
  missionId: number;
  startAt: string;
  endAt: string;
  location: string | null;
  capacity: number | null;
  activeCount: number;
  confirmedCount: number;
}

export interface DashboardTodoList {
  mandatoryIncomplete: DashboardTodoMission[];
  unstarted: DashboardTodoShift[];
  withoutConfirmedStaff: DashboardTodoShift[];
  optionalIncomplete: DashboardTodoMission[];
}
