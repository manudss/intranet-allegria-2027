import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Volunteer,
  VolunteerMission,
  VolunteerMissionStatus,
  VolunteerShift,
  VolunteerShiftAssignmentStatus,
  VolunteerShiftStatus,
  VolunteerTeam,
  VolunteerTeamMembership,
  MissionStatusLog,
  ShiftStatusLog,
} from '../entities';
import {
  ChangeVolunteerMissionStatusDto,
  ChangeVolunteerShiftStatusDto,
  CreateVolunteerMissionDto,
  CreateVolunteerShiftDto,
  DayViewQueryDto,
  FindVolunteerMissionsQueryDto,
  UpdateVolunteerMissionDto,
  UpdateVolunteerShiftDto,
} from './volunteer-missions.types';

type SessionUser = { id: number; email: string; roles: string[] };

type ScopeContext = {
  readonly actorVolunteerId: number | null;
  readonly actorTeamIds: readonly number[];
  readonly fullAccess: boolean;
  readonly readOnly: boolean;
  readonly roleScopes: readonly ('HEALTH' | 'ANIMATOR' | 'LOGISTICS')[];
};

const MISSION_TRANSITIONS: Readonly<
  Record<VolunteerMissionStatus, readonly VolunteerMissionStatus[]>
> = {
  [VolunteerMissionStatus.DRAFT]: [VolunteerMissionStatus.TODO, VolunteerMissionStatus.CANCELLED],
  [VolunteerMissionStatus.TODO]: [
    VolunteerMissionStatus.IN_PROGRESS,
    VolunteerMissionStatus.DONE,
    VolunteerMissionStatus.NOT_DONE,
    VolunteerMissionStatus.CANCELLED,
  ],
  [VolunteerMissionStatus.IN_PROGRESS]: [
    VolunteerMissionStatus.DONE,
    VolunteerMissionStatus.NOT_DONE,
    VolunteerMissionStatus.CANCELLED,
  ],
  [VolunteerMissionStatus.DONE]: [],
  [VolunteerMissionStatus.CANCELLED]: [],
  [VolunteerMissionStatus.NOT_DONE]: [],
};

const SHIFT_TRANSITIONS: Readonly<Record<VolunteerShiftStatus, readonly VolunteerShiftStatus[]>> = {
  [VolunteerShiftStatus.TODO]: [
    VolunteerShiftStatus.ASSIGNED,
    VolunteerShiftStatus.IN_PROGRESS,
    VolunteerShiftStatus.DONE,
    VolunteerShiftStatus.NOT_DONE,
    VolunteerShiftStatus.CANCELLED,
  ],
  [VolunteerShiftStatus.ASSIGNED]: [
    VolunteerShiftStatus.IN_PROGRESS,
    VolunteerShiftStatus.DONE,
    VolunteerShiftStatus.NOT_DONE,
    VolunteerShiftStatus.CANCELLED,
  ],
  [VolunteerShiftStatus.IN_PROGRESS]: [
    VolunteerShiftStatus.DONE,
    VolunteerShiftStatus.NOT_DONE,
    VolunteerShiftStatus.CANCELLED,
  ],
  [VolunteerShiftStatus.DONE]: [VolunteerShiftStatus.NOT_DONE],
  [VolunteerShiftStatus.CANCELLED]: [],
  [VolunteerShiftStatus.NOT_DONE]: [],
};

@Injectable()
export class VolunteerMissionsService {
  constructor(
    @InjectRepository(VolunteerMission)
    private readonly missionsRepository: Repository<VolunteerMission>,
    @InjectRepository(VolunteerShift)
    private readonly shiftsRepository: Repository<VolunteerShift>,
    @InjectRepository(VolunteerTeam)
    private readonly teamsRepository: Repository<VolunteerTeam>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepository: Repository<Volunteer>,
    @InjectRepository(VolunteerTeamMembership)
    private readonly membershipsRepository: Repository<VolunteerTeamMembership>,
    @InjectRepository(MissionStatusLog)
    private readonly missionStatusLogsRepository: Repository<MissionStatusLog>,
    @InjectRepository(ShiftStatusLog)
    private readonly shiftStatusLogsRepository: Repository<ShiftStatusLog>,
  ) {}

  async create(actingUser: SessionUser, dto: CreateVolunteerMissionDto): Promise<VolunteerMission> {
    const scope = await this.resolveScope(actingUser);
    this.assertWriteScope(scope);

    const mission = this.missionsRepository.create({
      title: this.requireTrimmedText(dto.title, 'title', 200),
      description: this.normalizeOptionalText(dto.description),
      location: this.normalizeOptionalText(dto.location, 200),
      volunteerTeamId: dto.volunteerTeamId ?? null,
      responsibleVolunteerId: dto.responsibleVolunteerId ?? null,
      status: dto.status ?? VolunteerMissionStatus.DRAFT,
      isOptional: dto.isOptional ?? false,
    });

    await this.attachMissionReferences(mission);
    this.assertMissionInScope(scope, mission, false);

    const saved = await this.missionsRepository.save(mission);
    return this.findOne(actingUser, saved.id);
  }

  async findAll(
    actingUser: SessionUser,
    query: FindVolunteerMissionsQueryDto,
  ): Promise<VolunteerMission[]> {
    const scope = await this.resolveScope(actingUser);
    const qb = this.missionsRepository
      .createQueryBuilder('mission')
      .leftJoinAndSelect('mission.volunteerTeam', 'volunteerTeam')
      .leftJoinAndSelect('mission.responsibleVolunteer', 'responsibleVolunteer')
      .leftJoinAndSelect('mission.shifts', 'shift')
      .orderBy('mission.updatedAt', 'DESC')
      .addOrderBy('shift.startAt', 'ASC');

    if (query.volunteerTeamId) {
      qb.andWhere('mission.volunteer_team_id = :volunteerTeamId', {
        volunteerTeamId: query.volunteerTeamId,
      });
    }

    if (query.location?.trim()) {
      qb.andWhere("LOWER(COALESCE(mission.location, '')) LIKE :location", {
        location: `%${query.location.trim().toLowerCase()}%`,
      });
    }

    if (query.status) {
      qb.andWhere('mission.status = :status', { status: query.status });
    }

    if (query.date?.trim()) {
      const day = this.parseDay(query.date, 'date');
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM volunteer_shifts s
          WHERE s.mission_id = mission.id
            AND DATE(s.start_at) <= :day
            AND DATE(s.end_at) >= :day
        )`,
        { day },
      );
    }

    const missions = await qb.getMany();
    return missions.filter((mission) => this.canAccessMission(scope, mission));
  }

  async findOne(actingUser: SessionUser, id: number): Promise<VolunteerMission> {
    const scope = await this.resolveScope(actingUser);
    const mission = await this.missionsRepository.findOne({
      where: { id },
      relations: { volunteerTeam: true, responsibleVolunteer: true, shifts: true },
      order: { shifts: { startAt: 'ASC' } },
    });

    if (!mission) {
      throw new NotFoundException(`Mission bénévole ${id} introuvable`);
    }

    this.assertMissionInScope(scope, mission, true);
    return mission;
  }

  async update(
    actingUser: SessionUser,
    id: number,
    dto: UpdateVolunteerMissionDto,
  ): Promise<VolunteerMission> {
    const scope = await this.resolveScope(actingUser);
    this.assertWriteScope(scope);

    const mission = await this.findOne(actingUser, id);

    if (Object.prototype.hasOwnProperty.call(dto, 'title')) {
      mission.title = this.requireTrimmedText(dto.title, 'title', 200);
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'description')) {
      mission.description = this.normalizeOptionalText(dto.description);
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'location')) {
      mission.location = this.normalizeOptionalText(dto.location, 200);
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'volunteerTeamId')) {
      mission.volunteerTeamId = dto.volunteerTeamId ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'responsibleVolunteerId')) {
      mission.responsibleVolunteerId = dto.responsibleVolunteerId ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'status') && dto.status) {
      this.assertTransition(mission.status, dto.status, MISSION_TRANSITIONS, 'mission');
      mission.status = dto.status;
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'isOptional')) {
      mission.isOptional = dto.isOptional ?? false;
    }

    await this.attachMissionReferences(mission);
    this.assertMissionInScope(scope, mission, false);

    await this.missionsRepository.save(mission);
    return this.findOne(actingUser, mission.id);
  }

  async remove(actingUser: SessionUser, id: number): Promise<void> {
    const scope = await this.resolveScope(actingUser);
    this.assertWriteScope(scope);

    const mission = await this.findOne(actingUser, id);
    this.assertMissionInScope(scope, mission, false);
    await this.missionsRepository.remove(mission);
  }

  async changeStatus(
    actingUser: SessionUser,
    id: number,
    dto: ChangeVolunteerMissionStatusDto,
  ): Promise<VolunteerMission> {
    const mission = await this.findOne(actingUser, id);
    const scope = await this.resolveScope(actingUser);
    this.assertWriteScope(scope);
    this.assertMissionInScope(scope, mission, false);
    this.assertTransition(mission.status, dto.status, MISSION_TRANSITIONS, 'mission');

    const oldStatus = mission.status;
    mission.status = dto.status;
    await this.missionsRepository.save(mission);

    // Log the status change
    await this.missionStatusLogsRepository.save({
      missionId: mission.id,
      fromStatus: oldStatus,
      toStatus: dto.status,
      changedByUserId: actingUser.id,
      reason: dto.reason ?? null,
      isForced: dto.force ?? false,
    });

    return this.findOne(actingUser, mission.id);
  }

  async listShifts(actingUser: SessionUser, missionId: number): Promise<VolunteerShift[]> {
    await this.findOne(actingUser, missionId);
    const shifts = await this.shiftsRepository.find({
      where: { missionId },
      relations: { assignments: { volunteer: true, assignedByUser: true } },
      order: { startAt: 'ASC' },
    });

    return shifts.map((shift) => this.withAssignmentCounters(shift));
  }

  async createShift(
    actingUser: SessionUser,
    missionId: number,
    dto: CreateVolunteerShiftDto,
  ): Promise<VolunteerShift> {
    const scope = await this.resolveScope(actingUser);
    this.assertWriteScope(scope);

    const mission = await this.findOne(actingUser, missionId);
    this.assertMissionInScope(scope, mission, false);

    const shift = this.shiftsRepository.create({
      missionId,
      startAt: this.parseDateTime(dto.startAt, 'startAt'),
      endAt: this.parseDateTime(dto.endAt, 'endAt'),
      location: this.normalizeOptionalText(dto.location, 200),
      capacity: this.normalizeCapacity(dto.capacity),
      status: dto.status ?? VolunteerShiftStatus.TODO,
      isOptional: dto.isOptional ?? false,
      notes: this.normalizeOptionalText(dto.notes),
    });

    this.validateShiftPeriod(shift.startAt, shift.endAt);
    const saved = await this.shiftsRepository.save(shift);
    return this.findShift(missionId, saved.id);
  }

  async updateShift(
    actingUser: SessionUser,
    missionId: number,
    shiftId: number,
    dto: UpdateVolunteerShiftDto,
  ): Promise<VolunteerShift> {
    const scope = await this.resolveScope(actingUser);
    this.assertWriteScope(scope);

    const mission = await this.findOne(actingUser, missionId);
    this.assertMissionInScope(scope, mission, false);

    const shift = await this.findShift(missionId, shiftId);

    if (Object.prototype.hasOwnProperty.call(dto, 'startAt') && dto.startAt) {
      shift.startAt = this.parseDateTime(dto.startAt, 'startAt');
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'endAt') && dto.endAt) {
      shift.endAt = this.parseDateTime(dto.endAt, 'endAt');
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'location')) {
      shift.location = this.normalizeOptionalText(dto.location, 200);
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'capacity')) {
      shift.capacity = this.normalizeCapacity(dto.capacity);
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'status') && dto.status) {
      this.assertTransition(shift.status, dto.status, SHIFT_TRANSITIONS, 'shift');
      shift.status = dto.status;
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'isOptional')) {
      shift.isOptional = dto.isOptional ?? false;
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'notes')) {
      shift.notes = this.normalizeOptionalText(dto.notes);
    }

    this.validateShiftPeriod(shift.startAt, shift.endAt);
    await this.shiftsRepository.save(shift);
    return this.findShift(missionId, shift.id);
  }

  async removeShift(actingUser: SessionUser, missionId: number, shiftId: number): Promise<void> {
    const scope = await this.resolveScope(actingUser);
    this.assertWriteScope(scope);
    const mission = await this.findOne(actingUser, missionId);
    this.assertMissionInScope(scope, mission, false);
    const shift = await this.findShift(missionId, shiftId);
    await this.shiftsRepository.remove(shift);
  }

  async changeShiftStatus(
    actingUser: SessionUser,
    missionId: number,
    shiftId: number,
    dto: ChangeVolunteerShiftStatusDto,
  ): Promise<VolunteerShift> {
    const scope = await this.resolveScope(actingUser);
    this.assertWriteScope(scope);
    const mission = await this.findOne(actingUser, missionId);
    this.assertMissionInScope(scope, mission, false);

    const shift = await this.findShift(missionId, shiftId);

    // Check for restricted transitions
    if (
      shift.status === VolunteerShiftStatus.DONE &&
      dto.status === VolunteerShiftStatus.NOT_DONE
    ) {
      // Only ADMIN and COORDINATOR can transition from DONE to NOT_DONE
      if (!scope.fullAccess) {
        throw new ForbiddenException(
          'Seuls les ADMIN et COORDINATORS peuvent passer un shift de Terminé à Non réalisé',
        );
      }
    }

    this.assertTransition(shift.status, dto.status, SHIFT_TRANSITIONS, 'shift');

    const oldStatus = shift.status;
    shift.status = dto.status;
    await this.shiftsRepository.save(shift);

    // Log the status change
    await this.shiftStatusLogsRepository.save({
      shiftId: shift.id,
      fromStatus: oldStatus,
      toStatus: dto.status,
      changedByUserId: actingUser.id,
      reason: dto.reason ?? null,
    });

    // After updating shift status, recalculate mission status if appropriate
    await this.updateMissionStatusFromShifts(mission.id, actingUser);

    return this.findShift(missionId, shift.id);
  }

  async dayView(actingUser: SessionUser, query: DayViewQueryDto): Promise<VolunteerShift[]> {
    const scope = await this.resolveScope(actingUser);
    const day = this.parseDay(query.date ?? new Date().toISOString().slice(0, 10), 'date');

    const shifts = await this.shiftsRepository.find({
      relations: { mission: { volunteerTeam: true, responsibleVolunteer: true } },
      order: { startAt: 'ASC' },
    });

    return shifts.filter((shift) => {
      const startDay = shift.startAt.toISOString().slice(0, 10);
      const endDay = shift.endAt.toISOString().slice(0, 10);
      return startDay <= day && endDay >= day && this.canAccessMission(scope, shift.mission);
    });
  }

  async getStatusCounters(actingUser: SessionUser): Promise<{
    missions: Record<VolunteerMissionStatus, number>;
    shifts: Record<VolunteerShiftStatus, number>;
  }> {
    const scope = await this.resolveScope(actingUser);

    const missions = await this.missionsRepository.find({
      relations: { volunteerTeam: true, responsibleVolunteer: true },
    });

    const shifts = await this.shiftsRepository.find({
      relations: { mission: { volunteerTeam: true, responsibleVolunteer: true } },
    });

    const filteredMissions = missions.filter((m) => this.canAccessMission(scope, m));
    const filteredShifts = shifts.filter((s) => this.canAccessMission(scope, s.mission));

    const missionCounters = Object.values(VolunteerMissionStatus).reduce(
      (acc, status) => {
        acc[status] = filteredMissions.filter((m) => m.status === status).length;
        return acc;
      },
      {} as Record<VolunteerMissionStatus, number>,
    );

    const shiftCounters = Object.values(VolunteerShiftStatus).reduce(
      (acc, status) => {
        acc[status] = filteredShifts.filter((s) => s.status === status).length;
        return acc;
      },
      {} as Record<VolunteerShiftStatus, number>,
    );

    return {
      missions: missionCounters,
      shifts: shiftCounters,
    };
  }

  async listShiftsByStatus(
    actingUser: SessionUser,
    status: VolunteerShiftStatus,
    mandatory?: boolean,
  ): Promise<VolunteerShift[]> {
    const scope = await this.resolveScope(actingUser);

    const shifts = await this.shiftsRepository.find({
      where: { status },
      relations: {
        mission: { volunteerTeam: true, responsibleVolunteer: true },
        assignments: { volunteer: true, assignedByUser: true },
      },
      order: { startAt: 'ASC' },
    });

    return shifts
      .filter((shift) => this.canAccessMission(scope, shift.mission))
      .filter((shift) => (mandatory !== undefined ? shift.isOptional === !mandatory : true))
      .map((shift) => this.withAssignmentCounters(shift));
  }

  async listMissionsByStatus(
    actingUser: SessionUser,
    status: VolunteerMissionStatus,
    mandatory?: boolean,
  ): Promise<VolunteerMission[]> {
    const scope = await this.resolveScope(actingUser);

    const missions = await this.missionsRepository.find({
      where: { status },
      relations: { volunteerTeam: true, responsibleVolunteer: true, shifts: true },
      order: { updatedAt: 'DESC' },
    });

    return missions
      .filter((mission) => this.canAccessMission(scope, mission))
      .filter((mission) => (mandatory !== undefined ? mission.isOptional === !mandatory : true));
  }

  private async updateMissionStatusFromShifts(
    missionId: number,
    actingUser: SessionUser,
  ): Promise<void> {
    const mission = await this.missionsRepository.findOne({
      where: { id: missionId },
      relations: { shifts: true },
    });

    if (!mission || mission.shifts.length === 0) {
      return;
    }

    // Auto-calculate mission status from shifts if mission is in certain states
    if (
      mission.status === VolunteerMissionStatus.TODO ||
      mission.status === VolunteerMissionStatus.IN_PROGRESS
    ) {
      const shiftStatuses = mission.shifts.map((s) => s.status);

      // If all shifts are done, mark mission as done
      if (shiftStatuses.every((s) => s === VolunteerShiftStatus.DONE)) {
        mission.status = VolunteerMissionStatus.DONE;
        await this.missionsRepository.save(mission);
        await this.missionStatusLogsRepository.save({
          missionId: mission.id,
          fromStatus: VolunteerMissionStatus.TODO,
          toStatus: VolunteerMissionStatus.DONE,
          changedByUserId: actingUser.id,
          reason: 'Auto-calculé : tous les shifts sont terminés',
          isForced: false,
        });
      }
      // If all shifts are not_done or cancelled, mark mission as not_done
      else if (
        shiftStatuses.every(
          (s) => s === VolunteerShiftStatus.NOT_DONE || s === VolunteerShiftStatus.CANCELLED,
        )
      ) {
        mission.status = VolunteerMissionStatus.NOT_DONE;
        await this.missionsRepository.save(mission);
        await this.missionStatusLogsRepository.save({
          missionId: mission.id,
          fromStatus: VolunteerMissionStatus.TODO,
          toStatus: VolunteerMissionStatus.NOT_DONE,
          changedByUserId: actingUser.id,
          reason: 'Auto-calculé : tous les shifts ne sont pas réalisés',
          isForced: false,
        });
      }
      // If at least one shift is in progress, mark mission as in_progress
      else if (shiftStatuses.some((s) => s === VolunteerShiftStatus.IN_PROGRESS)) {
        if (mission.status !== VolunteerMissionStatus.IN_PROGRESS) {
          mission.status = VolunteerMissionStatus.IN_PROGRESS;
          await this.missionsRepository.save(mission);
        }
      }
    }
  }

  private async findShift(missionId: number, shiftId: number): Promise<VolunteerShift> {
    const shift = await this.shiftsRepository.findOne({
      where: { id: shiftId, missionId },
      relations: {
        mission: { volunteerTeam: true, responsibleVolunteer: true },
        assignments: { volunteer: true, assignedByUser: true },
      },
    });

    if (!shift) {
      throw new NotFoundException(`Shift ${shiftId} introuvable pour la mission ${missionId}`);
    }

    return this.withAssignmentCounters(shift);
  }

  private withAssignmentCounters(shift: VolunteerShift): VolunteerShift {
    const assignments = shift.assignments ?? [];
    const activeAssignmentsCount = assignments.filter(
      (assignment) => assignment.status !== VolunteerShiftAssignmentStatus.CANCELLED,
    ).length;
    const confirmedAssignmentsCount = assignments.filter(
      (assignment) => assignment.status === VolunteerShiftAssignmentStatus.CONFIRMED,
    ).length;

    return Object.assign(shift, {
      activeAssignmentsCount,
      confirmedAssignmentsCount,
    });
  }

  private validateShiftPeriod(startAt: Date, endAt: Date): void {
    if (endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException('endAt doit etre posterieur a startAt');
    }
  }

  private normalizeCapacity(value?: number | null): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException('capacity doit etre un entier positif');
    }

    return value;
  }

  private parseDateTime(value: string, fieldName: string): Date {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} est invalide`);
    }

    return parsed;
  }

  private parseDay(value: string, fieldName: string): string {
    const trimmed = value.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new BadRequestException(`${fieldName} doit respecter le format YYYY-MM-DD`);
    }

    return trimmed;
  }

  private normalizeOptionalText(value?: string | null, maxLength?: number): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return null;
    }

    if (maxLength && trimmed.length > maxLength) {
      throw new BadRequestException(`Le texte ne doit pas depasser ${maxLength} caracteres`);
    }

    return trimmed;
  }

  private requireTrimmedText(
    value: string | undefined,
    fieldName: string,
    maxLength: number,
  ): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${fieldName} est obligatoire`);
    }

    const trimmed = value.trim();

    if (trimmed.length > maxLength) {
      throw new BadRequestException(`${fieldName} ne doit pas depasser ${maxLength} caracteres`);
    }

    return trimmed;
  }

  private assertTransition<T extends string>(
    from: T,
    to: T,
    allowedTransitions: Readonly<Record<T, readonly T[]>>,
    entityName: string,
  ): void {
    if (from === to) {
      return;
    }

    const allowed = allowedTransitions[from] ?? [];

    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Transition de statut ${entityName} invalide: ${from} -> ${to}`,
      );
    }
  }

  private async attachMissionReferences(mission: VolunteerMission): Promise<void> {
    mission.volunteerTeam = mission.volunteerTeamId
      ? await this.teamsRepository.findOneBy({ id: mission.volunteerTeamId })
      : null;

    if (mission.volunteerTeamId && !mission.volunteerTeam) {
      throw new NotFoundException(`Equipe operationnelle ${mission.volunteerTeamId} introuvable`);
    }

    mission.responsibleVolunteer = mission.responsibleVolunteerId
      ? await this.volunteersRepository.findOneBy({ id: mission.responsibleVolunteerId })
      : null;

    if (mission.responsibleVolunteerId && !mission.responsibleVolunteer) {
      throw new NotFoundException(
        `Benevole responsable ${mission.responsibleVolunteerId} introuvable`,
      );
    }
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

  private assertMissionInScope(
    scope: ScopeContext,
    mission: VolunteerMission,
    readOperation: boolean,
  ): void {
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

    if (
      mission.responsibleVolunteerId &&
      mission.responsibleVolunteerId === scope.actorVolunteerId
    ) {
      return true;
    }

    if (mission.volunteerTeamId && scope.actorTeamIds.includes(mission.volunteerTeamId)) {
      return true;
    }

    if (scope.roleScopes.length > 0) {
      const code = mission.volunteerTeam?.code?.toUpperCase() ?? '';
      return scope.roleScopes.some((role) => this.matchesRoleScope(code, role));
    }

    // Roles de pilotage operationnel sans scope metier explicite restent limites a leur equipe.
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
