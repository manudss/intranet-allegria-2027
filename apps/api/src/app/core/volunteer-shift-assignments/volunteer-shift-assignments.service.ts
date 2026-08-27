import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Volunteer,
  VolunteerMission,
  VolunteerShift,
  VolunteerShiftAssignment,
  VolunteerShiftAssignmentStatus,
  VolunteerSkill,
  VolunteerTag,
  VolunteerTeamMembership,
} from '../entities';
import {
  CancelVolunteerShiftAssignmentDto,
  ChangeVolunteerShiftAssignmentStatusDto,
  CreateVolunteerShiftAssignmentDto,
  SearchShiftAssignmentVolunteerQueryDto,
} from './volunteer-shift-assignments.types';

type SessionUser = { id: number; email: string; roles: string[] };

type ScopeContext = {
  readonly actorVolunteerId: number | null;
  readonly actorTeamIds: readonly number[];
  readonly fullAccess: boolean;
  readonly readOnly: boolean;
  readonly roleScopes: readonly ('HEALTH' | 'ANIMATOR' | 'LOGISTICS')[];
};

type OverlapAssignment = {
  id: number;
  status: VolunteerShiftAssignmentStatus;
  shiftId: number;
  startAt: Date;
  endAt: Date;
  missionId: number;
  missionTitle: string;
};

type VolunteerSearchResult = {
  volunteer: Volunteer;
  hasOverlap: boolean;
};

@Injectable()
export class VolunteerShiftAssignmentsService {
  constructor(
    @InjectRepository(VolunteerShiftAssignment)
    private readonly assignmentsRepository: Repository<VolunteerShiftAssignment>,
    @InjectRepository(VolunteerShift)
    private readonly shiftsRepository: Repository<VolunteerShift>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepository: Repository<Volunteer>,
    @InjectRepository(VolunteerTeamMembership)
    private readonly membershipsRepository: Repository<VolunteerTeamMembership>,
  ) {}

  async listForShift(actingUser: SessionUser, missionId: number, shiftId: number, status?: VolunteerShiftAssignmentStatus) {
    const scope = await this.resolveScope(actingUser);
    const shift = await this.findShift(shiftId, missionId);
    this.assertMissionInScope(scope, shift.mission, true);

    const where: { shiftId: number; status?: VolunteerShiftAssignmentStatus } = { shiftId };
    if (status) {
      where.status = status;
    }

    return this.assignmentsRepository.find({
      where,
      relations: {
        volunteer: true,
        assignedByUser: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    actingUser: SessionUser,
    missionId: number,
    shiftId: number,
    dto: CreateVolunteerShiftAssignmentDto,
  ): Promise<VolunteerShiftAssignment> {
    const scope = await this.resolveScope(actingUser);
    this.assertWriteScope(scope);

    const shift = await this.findShift(shiftId, missionId);
    this.assertMissionInScope(scope, shift.mission, false);

    const volunteer = await this.findVolunteer(dto.volunteerId);

    const existing = await this.assignmentsRepository.findOneBy({ volunteerId: volunteer.id, shiftId: shift.id });
    if (existing) {
      throw new ConflictException('Ce benevole est deja affecte a ce shift');
    }

    const status = dto.status ?? VolunteerShiftAssignmentStatus.PROVISIONAL;
    await this.assertOverlapPolicy(shift, volunteer.id, status, dto.force ?? false, scope);

    const assignment = this.assignmentsRepository.create({
      volunteerId: volunteer.id,
      shiftId: shift.id,
      status,
      assignedByUserId: actingUser.id,
      notes: this.normalizeOptionalText(dto.notes),
    });

    const saved = await this.assignmentsRepository.save(assignment);
    return this.findOne(saved.id);
  }

  async changeStatus(
    actingUser: SessionUser,
    missionId: number,
    shiftId: number,
    assignmentId: number,
    dto: ChangeVolunteerShiftAssignmentStatusDto,
  ): Promise<VolunteerShiftAssignment> {
    const scope = await this.resolveScope(actingUser);
    this.assertWriteScope(scope);

    const assignment = await this.findOne(assignmentId);
    if (assignment.shiftId !== shiftId || assignment.shift.missionId !== missionId) {
      throw new NotFoundException(`Affectation ${assignmentId} introuvable pour ce shift`);
    }

    this.assertMissionInScope(scope, assignment.shift.mission, false);

    await this.assertOverlapPolicy(
      assignment.shift,
      assignment.volunteerId,
      dto.status,
      dto.force ?? false,
      scope,
      assignment.id,
    );

    assignment.status = dto.status;

    if (Object.prototype.hasOwnProperty.call(dto, 'notes')) {
      assignment.notes = this.normalizeOptionalText(dto.notes);
    }

    await this.assignmentsRepository.save(assignment);
    return this.findOne(assignment.id);
  }

  async cancel(
    actingUser: SessionUser,
    missionId: number,
    shiftId: number,
    assignmentId: number,
    dto: CancelVolunteerShiftAssignmentDto,
  ): Promise<VolunteerShiftAssignment> {
    return this.changeStatus(actingUser, missionId, shiftId, assignmentId, {
      status: VolunteerShiftAssignmentStatus.CANCELLED,
      notes: dto.notes,
    });
  }

  async listVolunteerPlanning(
    actingUser: SessionUser,
    volunteerId: number,
    status?: VolunteerShiftAssignmentStatus,
  ): Promise<VolunteerShiftAssignment[]> {
    const scope = await this.resolveScope(actingUser);

    const assignments = await this.assignmentsRepository.find({
      where: {
        volunteerId,
        ...(status ? { status } : {}),
      },
      relations: {
        volunteer: true,
        assignedByUser: true,
        shift: { mission: { volunteerTeam: true, responsibleVolunteer: true } },
      },
      order: { shift: { startAt: 'ASC' } },
    });

    return assignments.filter((assignment) => this.canAccessMission(scope, assignment.shift.mission));
  }

  async searchVolunteers(actingUser: SessionUser, query: SearchShiftAssignmentVolunteerQueryDto): Promise<VolunteerSearchResult[]> {
    const scope = await this.resolveScope(actingUser);
    const availableOnly = this.toBoolean(query.availableOnly);

    let intervalStart: Date | null = null;
    let intervalEnd: Date | null = null;

    if (query.shiftId) {
      const shift = await this.findShift(query.shiftId);
      this.assertMissionInScope(scope, shift.mission, true);
      intervalStart = shift.startAt;
      intervalEnd = shift.endAt;
    } else if (query.startAt && query.endAt) {
      intervalStart = this.parseDateTime(query.startAt, 'startAt');
      intervalEnd = this.parseDateTime(query.endAt, 'endAt');
      if (intervalEnd.getTime() <= intervalStart.getTime()) {
        throw new BadRequestException('endAt doit etre posterieur a startAt');
      }
    }

    const qb = this.volunteersRepository
      .createQueryBuilder('volunteer')
      .leftJoinAndSelect('volunteer.user', 'user')
      .orderBy('volunteer.lastName', 'ASC')
      .addOrderBy('volunteer.firstName', 'ASC');

    if (query.q?.trim()) {
      const q = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere("LOWER(CONCAT(volunteer.firstName, ' ', volunteer.lastName)) LIKE :q", { q });
    }

    if (query.skill) {
      qb.innerJoin(VolunteerSkill, 'skill', 'skill.volunteer_id = volunteer.id AND skill.skill = :skill', {
        skill: query.skill,
      });
    }

    if (query.tag?.trim()) {
      qb.innerJoin(VolunteerTag, 'tag', 'tag.volunteer_id = volunteer.id AND LOWER(tag.value) LIKE :tag', {
        tag: `%${query.tag.trim().toLowerCase()}%`,
      });
    }

    if (query.volunteerTeamId) {
      qb.innerJoin(
        VolunteerTeamMembership,
        'membership',
        'membership.volunteer_id = volunteer.id AND membership.volunteer_team_id = :volunteerTeamId',
        { volunteerTeamId: query.volunteerTeamId },
      );
    }

    if (availableOnly && intervalStart && intervalEnd) {
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM volunteer_shift_assignments assignment
          INNER JOIN volunteer_shifts shift ON shift.id = assignment.shift_id
          WHERE assignment.volunteer_id = volunteer.id
            AND assignment.status != :cancelledStatus
            AND shift.id != COALESCE(:excludedShiftId, -1)
            AND shift."startAt" < :endAt
            AND shift."endAt" > :startAt
        )`,
        {
          cancelledStatus: VolunteerShiftAssignmentStatus.CANCELLED,
          excludedShiftId: query.shiftId ?? null,
          startAt: intervalStart.toISOString(),
          endAt: intervalEnd.toISOString(),
        },
      );
    }

    const volunteers = await qb.getMany();

    if (!intervalStart || !intervalEnd) {
      return volunteers.map((volunteer) => ({ volunteer, hasOverlap: false }));
    }

    const results = await Promise.all(
      volunteers.map(async (volunteer) => {
        const overlaps = await this.findOverlaps(volunteer.id, intervalStart as Date, intervalEnd as Date, query.shiftId);
        return { volunteer, hasOverlap: overlaps.length > 0 };
      }),
    );

    return results;
  }

  private async findOne(id: number): Promise<VolunteerShiftAssignment> {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id },
      relations: {
        volunteer: true,
        assignedByUser: true,
        shift: { mission: { volunteerTeam: true, responsibleVolunteer: true } },
      },
    });

    if (!assignment) {
      throw new NotFoundException(`Affectation ${id} introuvable`);
    }

    return assignment;
  }

  private async findShift(shiftId: number, missionId?: number): Promise<VolunteerShift> {
    const shift = await this.shiftsRepository.findOne({
      where: {
        id: shiftId,
        ...(missionId ? { missionId } : {}),
      },
      relations: {
        mission: { volunteerTeam: true, responsibleVolunteer: true },
      },
    });

    if (!shift) {
      throw new NotFoundException(`Shift ${shiftId} introuvable`);
    }

    return shift;
  }

  private async findVolunteer(volunteerId: number): Promise<Volunteer> {
    const volunteer = await this.volunteersRepository.findOneBy({ id: volunteerId });
    if (!volunteer) {
      throw new NotFoundException(`Benevole ${volunteerId} introuvable`);
    }
    return volunteer;
  }

  private async assertOverlapPolicy(
    shift: VolunteerShift,
    volunteerId: number,
    status: VolunteerShiftAssignmentStatus,
    force: boolean,
    scope: ScopeContext,
    excludedAssignmentId?: number,
  ): Promise<void> {
    if (status === VolunteerShiftAssignmentStatus.CANCELLED) {
      return;
    }

    const overlaps = await this.findOverlaps(volunteerId, shift.startAt, shift.endAt, shift.id, excludedAssignmentId);

    if (overlaps.length === 0) {
      return;
    }

    if (force) {
      if (!scope.fullAccess) {
        throw new ForbiddenException('Seuls ADMIN et COORDINATOR peuvent forcer un chevauchement');
      }
      return;
    }

    throw new ConflictException({
      message: 'Chevauchement detecte pour ce benevole',
      canForce: scope.fullAccess,
      overlaps: overlaps.map((overlap) => ({
        assignmentId: overlap.id,
        shiftId: overlap.shiftId,
        missionId: overlap.missionId,
        missionTitle: overlap.missionTitle,
        startAt: overlap.startAt,
        endAt: overlap.endAt,
        status: overlap.status,
      })),
    });
  }

  private async findOverlaps(
    volunteerId: number,
    startAt: Date,
    endAt: Date,
    excludedShiftId?: number,
    excludedAssignmentId?: number,
  ): Promise<OverlapAssignment[]> {
    const qb = this.assignmentsRepository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.shift', 'shift')
      .innerJoinAndSelect('shift.mission', 'mission')
      .where('assignment.volunteer_id = :volunteerId', { volunteerId })
      .andWhere('assignment.status != :cancelled', { cancelled: VolunteerShiftAssignmentStatus.CANCELLED })
      .andWhere('shift."startAt" < :endAt', { endAt: endAt.toISOString() })
      .andWhere('shift."endAt" > :startAt', { startAt: startAt.toISOString() });

    if (excludedShiftId) {
      qb.andWhere('shift.id != :excludedShiftId', { excludedShiftId });
    }

    if (excludedAssignmentId) {
      qb.andWhere('assignment.id != :excludedAssignmentId', { excludedAssignmentId });
    }

    const rows = await qb.getMany();
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      shiftId: row.shiftId,
      startAt: row.shift.startAt,
      endAt: row.shift.endAt,
      missionId: row.shift.missionId,
      missionTitle: row.shift.mission.title,
    }));
  }

  async getCountsForShift(shiftId: number): Promise<{ activeAssignmentsCount: number; confirmedAssignmentsCount: number }> {
    const rows = await this.assignmentsRepository
      .createQueryBuilder('assignment')
      .select('assignment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('assignment.shift_id = :shiftId', { shiftId })
      .groupBy('assignment.status')
      .getRawMany<{ status: VolunteerShiftAssignmentStatus; count: string }>();

    let activeAssignmentsCount = 0;
    let confirmedAssignmentsCount = 0;

    for (const row of rows) {
      const count = Number(row.count);
      if (row.status !== VolunteerShiftAssignmentStatus.CANCELLED) {
        activeAssignmentsCount += count;
      }
      if (row.status === VolunteerShiftAssignmentStatus.CONFIRMED) {
        confirmedAssignmentsCount += count;
      }
    }

    return { activeAssignmentsCount, confirmedAssignmentsCount };
  }

  private parseDateTime(value: string, fieldName: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} est invalide`);
    }
    return parsed;
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }

    return false;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async resolveScope(actingUser: SessionUser): Promise<ScopeContext> {
    const roles = actingUser.roles;
    const fullAccess = roles.includes('ADMIN') || roles.includes('COORDINATOR');
    const readOnly = roles.includes('VIEWER') && !fullAccess;

    const roleScopes: ('HEALTH' | 'ANIMATOR' | 'LOGISTICS')[] = [];
    if (roles.includes('HEALTH')) roleScopes.push('HEALTH');
    if (roles.includes('ANIMATOR')) roleScopes.push('ANIMATOR');
    if (roles.includes('LOGISTICS')) roleScopes.push('LOGISTICS');

    const actorVolunteer = await this.volunteersRepository.findOne({
      where: { user: { id: actingUser.id } },
      relations: { user: true },
    });

    const actorVolunteerId = actorVolunteer?.id ?? null;

    if (!actorVolunteerId) {
      return { actorVolunteerId: null, actorTeamIds: [], fullAccess, readOnly, roleScopes };
    }

    const memberships = await this.membershipsRepository.find({
      where: { volunteerId: actorVolunteerId },
      select: { volunteerTeamId: true },
    });

    return {
      actorVolunteerId,
      actorTeamIds: memberships.map((membership) => membership.volunteerTeamId),
      fullAccess,
      readOnly,
      roleScopes,
    };
  }

  private assertWriteScope(scope: ScopeContext): void {
    if (scope.readOnly) {
      throw new ForbiddenException('Acces en lecture seule');
    }
  }

  private assertMissionInScope(scope: ScopeContext, mission: VolunteerMission, readOperation: boolean): void {
    if (readOperation && scope.readOnly) {
      return;
    }

    if (!this.canAccessMission(scope, mission)) {
      throw new ForbiddenException('Mission hors perimetre');
    }
  }

  private canAccessMission(scope: ScopeContext, mission: VolunteerMission): boolean {
    if (scope.fullAccess || scope.readOnly) {
      return true;
    }

    if (mission.responsibleVolunteerId && mission.responsibleVolunteerId === scope.actorVolunteerId) {
      return true;
    }

    if (mission.volunteerTeamId && scope.actorTeamIds.includes(mission.volunteerTeamId)) {
      return true;
    }

    if (scope.roleScopes.length > 0) {
      const code = mission.volunteerTeam?.code?.toUpperCase() ?? '';
      return scope.roleScopes.some((role) => this.matchesRoleScope(code, role));
    }

    return false;
  }

  private matchesRoleScope(teamCode: string, role: 'HEALTH' | 'ANIMATOR' | 'LOGISTICS'): boolean {
    if (role === 'HEALTH') {
      return teamCode.includes('HEALTH') || teamCode.includes('SANTE');
    }

    if (role === 'ANIMATOR') {
      return teamCode.includes('ANIM');
    }

    return teamCode.includes('LOG');
  }
}





