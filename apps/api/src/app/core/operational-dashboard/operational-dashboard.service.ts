import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  VolunteerMissionStatus,
  VolunteerShiftAssignmentStatus,
  VolunteerShiftStatus,
  Volunteer,
  VolunteerMission,
  VolunteerShift,
  VolunteerShiftAssignment,
  VolunteerTeam,
  VolunteerTeamMembership,
} from '../entities';
import {
  DashboardGlobalSummary,
  DashboardLocationRow,
  DashboardQueryDto,
  DashboardTeamSummary,
  DashboardTodoList,
  DashboardWhoDoesWhatItem,
  DashboardWhoDoesWhatQueryDto,
  DashboardWhoDoesWhatResult,
  OperationalExportFormat,
  OperationalExportKind,
  OperationalExportQueryDto,
  ShiftsByStatus,
} from './operational-dashboard.types';

type OperationalExportFile = {
  fileName: string;
  contentType: string;
  body: Buffer;
};

type OperationalExportRow = {
  missionId: number;
  missionTitle: string;
  missionStatus: VolunteerMissionStatus;
  teamName: string | null;
  teamCode: string | null;
  location: string | null;
  shiftId: number;
  shiftStatus: VolunteerShiftStatus;
  shiftStartAt: Date;
  shiftEndAt: Date;
  shiftCapacity: number | null;
  assignmentId: number | null;
  assignmentStatus: VolunteerShiftAssignmentStatus | null;
  volunteerId: number | null;
  volunteerFirstName: string | null;
  volunteerLastName: string | null;
};

type NormalizedOperationalExportQuery = OperationalExportQueryDto & {
  date: string;
  dateFrom: string;
  dateTo: string;
  format: OperationalExportFormat;
};

type SessionUser = { id: number; email: string; roles: string[] };

type ScopeContext = {
  readonly actorVolunteerId: number | null;
  readonly actorTeamIds: readonly number[];
  readonly fullAccess: boolean;
  readonly readOnly: boolean;
  readonly roleScopes: readonly ('HEALTH' | 'ANIMATOR' | 'LOGISTICS')[];
};

// NOTE: pour la production, ajouter un index sur volunteer_shifts("startAt", "endAt")
// pour accélérer les filtres par date du tableau de bord.

@Injectable()
export class OperationalDashboardService {
  constructor(
    @InjectRepository(VolunteerMission)
    private readonly missionsRepo: Repository<VolunteerMission>,
    @InjectRepository(VolunteerShift)
    private readonly shiftsRepo: Repository<VolunteerShift>,
    @InjectRepository(VolunteerShiftAssignment)
    private readonly assignmentsRepo: Repository<VolunteerShiftAssignment>,
    @InjectRepository(VolunteerTeam)
    private readonly teamsRepo: Repository<VolunteerTeam>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepo: Repository<Volunteer>,
    @InjectRepository(VolunteerTeamMembership)
    private readonly membershipsRepo: Repository<VolunteerTeamMembership>,
  ) {}

  // ─── Vue globale du jour ────────────────────────────────────────────────────

  async getGlobalSummary(actingUser: SessionUser, query: DashboardQueryDto): Promise<DashboardGlobalSummary> {
    const scope = await this.resolveScope(actingUser);
    const day = this.parseDay(query.date);

    // 1. Compteurs missions + shifts par statut (en une requête agrégée)
    const countersQb = this.shiftsRepo
      .createQueryBuilder('s')
      .innerJoin('s.mission', 'm')
      .leftJoin('m.volunteerTeam', 'vt')
      .select('COUNT(DISTINCT m.id)::int', 'missionCount')
      .addSelect('COUNT(s.id)::int', 'shiftCount')
      .addSelect("SUM(CASE WHEN s.status = 'TODO' THEN 1 ELSE 0 END)::int", 'shiftsTodo')
      .addSelect("SUM(CASE WHEN s.status = 'ASSIGNED' THEN 1 ELSE 0 END)::int", 'shiftsAssigned')
      .addSelect("SUM(CASE WHEN s.status = 'IN_PROGRESS' THEN 1 ELSE 0 END)::int", 'shiftsInProgress')
      .addSelect("SUM(CASE WHEN s.status = 'DONE' THEN 1 ELSE 0 END)::int", 'shiftsDone')
      .addSelect("SUM(CASE WHEN s.status = 'CANCELLED' THEN 1 ELSE 0 END)::int", 'shiftsCancelled')
      .addSelect("SUM(CASE WHEN s.status = 'NOT_DONE' THEN 1 ELSE 0 END)::int", 'shiftsNotDone')
      .where('DATE(s.startAt) <= :day AND DATE(s.endAt) >= :day', { day });
    this.applyScopeFilter(countersQb, scope, 'm', 'vt');
    const counters = await countersQb.getRawOne<{
      missionCount: number; shiftCount: number;
      shiftsTodo: number; shiftsAssigned: number; shiftsInProgress: number;
      shiftsDone: number; shiftsCancelled: number; shiftsNotDone: number;
    }>();

    // 2. Shifts sans affectation confirmée (hors statuts terminaux)
    const withoutConfirmedQb = this.shiftsRepo
      .createQueryBuilder('s')
      .innerJoin('s.mission', 'm')
      .leftJoin('m.volunteerTeam', 'vt')
      .where('DATE(s.startAt) <= :day AND DATE(s.endAt) >= :day', { day })
      .andWhere("s.status NOT IN ('DONE', 'CANCELLED', 'NOT_DONE')")
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM volunteer_shift_assignments vsa WHERE vsa.shift_id = s.id AND vsa.status = 'CONFIRMED')`,
      );
    this.applyScopeFilter(withoutConfirmedQb, scope, 'm', 'vt');
    const shiftsWithoutConfirmed = await withoutConfirmedQb.getCount();

    // 3. Shifts sous-dotés (capacité renseignée, actifs, affectations < capacité)
    const understaffedQb = this.shiftsRepo
      .createQueryBuilder('s')
      .innerJoin('s.mission', 'm')
      .leftJoin('m.volunteerTeam', 'vt')
      .where('DATE(s.startAt) <= :day AND DATE(s.endAt) >= :day', { day })
      .andWhere('s.capacity IS NOT NULL')
      .andWhere("s.status NOT IN ('DONE', 'CANCELLED', 'NOT_DONE')")
      .andWhere(
        `(SELECT COUNT(*) FROM volunteer_shift_assignments vsa WHERE vsa.shift_id = s.id AND vsa.status != 'CANCELLED') < s.capacity`,
      );
    this.applyScopeFilter(understaffedQb, scope, 'm', 'vt');
    const understaffedShifts = await understaffedQb.getCount();

    // 4. Bénévoles affectés (distincts, hors annulés)
    const assignedQb = this.assignmentsRepo
      .createQueryBuilder('vsa')
      .innerJoin('vsa.shift', 's')
      .innerJoin('s.mission', 'm')
      .leftJoin('m.volunteerTeam', 'vt')
      .select('COUNT(DISTINCT vsa.volunteer_id)::int', 'cnt')
      .where('DATE(s.startAt) <= :day AND DATE(s.endAt) >= :day', { day })
      .andWhere("vsa.status != 'CANCELLED'");
    this.applyScopeFilter(assignedQb, scope, 'm', 'vt');
    const assignedRaw = await assignedQb.getRawOne<{ cnt: number }>();

    // 5. Bénévoles en affectation PROVISIONAL (distincts)
    const provisionalQb = this.assignmentsRepo
      .createQueryBuilder('vsa')
      .innerJoin('vsa.shift', 's')
      .innerJoin('s.mission', 'm')
      .leftJoin('m.volunteerTeam', 'vt')
      .select('COUNT(DISTINCT vsa.volunteer_id)::int', 'cnt')
      .where('DATE(s.startAt) <= :day AND DATE(s.endAt) >= :day', { day })
      .andWhere("vsa.status = 'PROVISIONAL'");
    this.applyScopeFilter(provisionalQb, scope, 'm', 'vt');
    const provisionalRaw = await provisionalQb.getRawOne<{ cnt: number }>();

    return {
      date: day,
      missionCount: counters?.missionCount ?? 0,
      shiftCount: counters?.shiftCount ?? 0,
      shiftsByStatus: {
        TODO: counters?.shiftsTodo ?? 0,
        ASSIGNED: counters?.shiftsAssigned ?? 0,
        IN_PROGRESS: counters?.shiftsInProgress ?? 0,
        DONE: counters?.shiftsDone ?? 0,
        CANCELLED: counters?.shiftsCancelled ?? 0,
        NOT_DONE: counters?.shiftsNotDone ?? 0,
      },
      shiftsWithoutConfirmedAssignment: shiftsWithoutConfirmed,
      understaffedShifts,
      assignedVolunteers: assignedRaw?.cnt ?? 0,
      provisionalVolunteers: provisionalRaw?.cnt ?? 0,
    };
  }

  // ─── Vue par équipe opérationnelle ─────────────────────────────────────────

  async getTeamsSummary(actingUser: SessionUser, query: DashboardQueryDto): Promise<DashboardTeamSummary[]> {
    const scope = await this.resolveScope(actingUser);
    const day = this.parseDay(query.date);

    const qb = this.shiftsRepo
      .createQueryBuilder('s')
      .innerJoin('s.mission', 'm')
      .innerJoin('m.volunteerTeam', 'vt')
      .select('vt.id', 'teamId')
      .addSelect('vt.name', 'teamName')
      .addSelect('vt.code', 'teamCode')
      .addSelect('COUNT(DISTINCT m.id)::int', 'missionCount')
      .addSelect("SUM(CASE WHEN s.status = 'TODO' THEN 1 ELSE 0 END)::int", 'shiftsTodo')
      .addSelect("SUM(CASE WHEN s.status = 'ASSIGNED' THEN 1 ELSE 0 END)::int", 'shiftsAssigned')
      .addSelect("SUM(CASE WHEN s.status = 'IN_PROGRESS' THEN 1 ELSE 0 END)::int", 'shiftsInProgress')
      .addSelect("SUM(CASE WHEN s.status = 'DONE' THEN 1 ELSE 0 END)::int", 'shiftsDone')
      .addSelect("SUM(CASE WHEN s.status = 'CANCELLED' THEN 1 ELSE 0 END)::int", 'shiftsCancelled')
      .addSelect("SUM(CASE WHEN s.status = 'NOT_DONE' THEN 1 ELSE 0 END)::int", 'shiftsNotDone')
      .addSelect('COALESCE(SUM(s.capacity), 0)::int', 'totalCapacity')
      .where('DATE(s.startAt) <= :day AND DATE(s.endAt) >= :day', { day })
      .groupBy('vt.id')
      .addGroupBy('vt.name')
      .addGroupBy('vt.code')
      .orderBy('vt.name', 'ASC');
    this.applyScopeFilter(qb, scope, 'm', 'vt');

    if (query.volunteerTeamId) {
      qb.andWhere('vt.id = :teamFilterId', { teamFilterId: query.volunteerTeamId });
    }

    type TeamRow = {
      teamId: number; teamName: string; teamCode: string; missionCount: number;
      shiftsTodo: number; shiftsAssigned: number; shiftsInProgress: number;
      shiftsDone: number; shiftsCancelled: number; shiftsNotDone: number;
      totalCapacity: number;
    };
    const rows = await qb.getRawMany<TeamRow>();

    return Promise.all(
      rows.map(async (row) => {
        const confQb = this.assignmentsRepo
          .createQueryBuilder('vsa')
          .innerJoin('vsa.shift', 's')
          .innerJoin('s.mission', 'm')
          .select('COUNT(DISTINCT vsa.volunteer_id)::int', 'cnt')
      .where('DATE(s.startAt) <= :day AND DATE(s.endAt) >= :day', { day })
          .andWhere("vsa.status = 'CONFIRMED'")
          .andWhere('m.volunteer_team_id = :tid', { tid: row.teamId });
        const confRaw = await confQb.getRawOne<{ cnt: number }>();

        const provQb = this.assignmentsRepo
          .createQueryBuilder('vsa')
          .innerJoin('vsa.shift', 's')
          .innerJoin('s.mission', 'm')
          .select('COUNT(DISTINCT vsa.volunteer_id)::int', 'cnt')
      .where('DATE(s.startAt) <= :day AND DATE(s.endAt) >= :day', { day })
          .andWhere("vsa.status = 'PROVISIONAL'")
          .andWhere('m.volunteer_team_id = :tid', { tid: row.teamId });
        const provRaw = await provQb.getRawOne<{ cnt: number }>();

        const alerts: string[] = [];
        if (row.shiftsTodo > 0) alerts.push(`${row.shiftsTodo} shift(s) non commencé(s)`);
        if ((provRaw?.cnt ?? 0) > 0) alerts.push(`${provRaw!.cnt} bénévole(s) en affectation provisoire`);

        const byStatus: ShiftsByStatus = {
          TODO: row.shiftsTodo, ASSIGNED: row.shiftsAssigned, IN_PROGRESS: row.shiftsInProgress,
          DONE: row.shiftsDone, CANCELLED: row.shiftsCancelled, NOT_DONE: row.shiftsNotDone,
        };

        return {
          teamId: row.teamId,
          teamName: row.teamName,
          teamCode: row.teamCode,
          missionCount: row.missionCount,
          shiftsByStatus: byStatus,
          totalCapacity: row.totalCapacity ?? 0,
          confirmedVolunteers: confRaw?.cnt ?? 0,
          provisionalVolunteers: provRaw?.cnt ?? 0,
          alerts,
        } satisfies DashboardTeamSummary;
      }),
    );
  }

  // ─── Vue par lieu ───────────────────────────────────────────────────────────

  async getLocationsSummary(actingUser: SessionUser, query: DashboardQueryDto): Promise<DashboardLocationRow[]> {
    const scope = await this.resolveScope(actingUser);
    const day = this.parseDay(query.date);

    // Agrégation par lieu (s.location fallback sur m.location)
    const qb = this.shiftsRepo
      .createQueryBuilder('s')
      .innerJoin('s.mission', 'm')
      .leftJoin('m.volunteerTeam', 'vt')
      .leftJoin('s.assignments', 'vsa', "vsa.status != 'CANCELLED'")
      .select("COALESCE(s.location, m.location, 'Non spécifié')", 'location')
      .addSelect("SUM(CASE WHEN s.status = 'IN_PROGRESS' THEN 1 ELSE 0 END)::int", 'shiftsInProgress')
      .addSelect("SUM(CASE WHEN s.status IN ('TODO', 'ASSIGNED') THEN 1 ELSE 0 END)::int", 'shiftsUpcoming')
      .addSelect('COUNT(DISTINCT vsa.volunteer_id)::int', 'assignedVolunteers')
      .addSelect('COALESCE(SUM(DISTINCT s.capacity), 0)::int', 'totalCapacity')
      .where('DATE(s.startAt) <= :day AND DATE(s.endAt) >= :day', { day })
      .groupBy("COALESCE(s.location, m.location, 'Non spécifié')")
      .orderBy("COALESCE(s.location, m.location, 'Non spécifié')", 'ASC');
    this.applyScopeFilter(qb, scope, 'm', 'vt');

    type LocRow = { location: string; shiftsInProgress: number; shiftsUpcoming: number; assignedVolunteers: number; totalCapacity: number };
    const rows = await qb.getRawMany<LocRow>();

    return rows.map((row) => {
      const alerts: string[] = [];
      if (row.totalCapacity > 0 && row.assignedVolunteers < row.totalCapacity) {
        alerts.push(`Sous-effectif : ${row.assignedVolunteers}/${row.totalCapacity} bénévoles`);
      }
      return {
        location: row.location,
        shiftsInProgress: row.shiftsInProgress ?? 0,
        shiftsUpcoming: row.shiftsUpcoming ?? 0,
        assignedVolunteers: row.assignedVolunteers ?? 0,
        alerts,
      };
    });
  }

  // ─── Vue "Qui fait quoi" ────────────────────────────────────────────────────

  async getWhoDoesWhat(actingUser: SessionUser, query: DashboardWhoDoesWhatQueryDto): Promise<DashboardWhoDoesWhatResult> {
    const scope = await this.resolveScope(actingUser);
    const day = this.parseDay(query.date);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const page = Math.max(1, query.page ?? 1);
    const offset = (page - 1) * limit;
    const searchQ = query.q?.trim().toLowerCase() ?? '';

    // Base conditions partagées
    const applyBase = (qb: SelectQueryBuilder<any>) => {
      qb.where('DATE(s.startAt) <= :day AND DATE(s.endAt) >= :day', { day })
        .andWhere("vsa.status != 'CANCELLED'");
      if (searchQ) {
        qb.andWhere(
          "(LOWER(v.firstName) LIKE :q OR LOWER(v.lastName) LIKE :q OR LOWER(CONCAT(v.firstName, ' ', v.lastName)) LIKE :q)",
          { q: `%${searchQ}%` },
        );
      }
      if (query.volunteerTeamId) {
        qb.andWhere('m.volunteer_team_id = :volTeamId', { volTeamId: query.volunteerTeamId });
      }
      this.applyScopeFilter(qb, scope, 'm', 'vt');
    };

    // Compter le total de bénévoles distincts
    const totalQb = this.assignmentsRepo
      .createQueryBuilder('vsa')
      .innerJoin('vsa.shift', 's')
      .innerJoin('s.mission', 'm')
      .leftJoin('m.volunteerTeam', 'vt')
      .innerJoin('vsa.volunteer', 'v')
      .select('COUNT(DISTINCT v.id)::int', 'total');
    applyBase(totalQb);
    const totalRaw = await totalQb.getRawOne<{ total: number }>();
    const total = totalRaw?.total ?? 0;

    if (total === 0) {
      return { items: [], total: 0, limit, offset };
    }

    // Récupérer les IDs de bénévoles paginés
    const volQb = this.assignmentsRepo
      .createQueryBuilder('vsa')
      .innerJoin('vsa.shift', 's')
      .innerJoin('s.mission', 'm')
      .leftJoin('m.volunteerTeam', 'vt')
      .innerJoin('vsa.volunteer', 'v')
      .select('v.id', 'volunteerId')
      .addSelect('v.firstName', 'firstName')
      .addSelect('v.lastName', 'lastName')
      .groupBy('v.id, v.firstName, v.lastName')
      .orderBy('v.lastName', 'ASC')
      .addOrderBy('v.firstName', 'ASC')
      .limit(limit)
      .offset(offset);
    applyBase(volQb);
    const volRows = await volQb.getRawMany<{ volunteerId: number; firstName: string; lastName: string }>();

    if (volRows.length === 0) {
      return { items: [], total, limit, offset };
    }

    const volunteerIds = volRows.map((r) => r.volunteerId);

    // Récupérer toutes les affectations pour ces bénévoles ce jour
    const assignRows = await this.assignmentsRepo
      .createQueryBuilder('vsa')
      .innerJoin('vsa.shift', 's')
      .innerJoin('s.mission', 'm')
      .leftJoin('m.volunteerTeam', 'vt')
      .select('vsa.volunteer_id', 'volunteerId')
      .addSelect('vsa.status', 'assignmentStatus')
      .addSelect('s.id', 'shiftId')
      .addSelect('s.startAt', 'startAt')
      .addSelect('s.endAt', 'endAt')
      .addSelect('s.location', 'shiftLocation')
      .addSelect('s.status', 'shiftStatus')
      .addSelect('m.id', 'missionId')
      .addSelect('m.title', 'missionTitle')
      .addSelect('vt.name', 'teamName')
      .where('DATE(s.startAt) <= :day AND DATE(s.endAt) >= :day', { day })
      .andWhere("vsa.status != 'CANCELLED'")
      .andWhere('vsa.volunteer_id IN (:...volunteerIds)', { volunteerIds })
      .orderBy('vsa.volunteer_id', 'ASC')
      .addOrderBy('s.startAt', 'ASC')
      .getRawMany<{
        volunteerId: number; assignmentStatus: string;
        shiftId: number; startAt: string; endAt: string; shiftLocation: string | null; shiftStatus: string;
        missionId: number; missionTitle: string; teamName: string | null;
      }>();

    // Regrouper par bénévole
    const volMap = new Map<number, DashboardWhoDoesWhatItem>();
    for (const r of volRows) {
      volMap.set(r.volunteerId, { volunteerId: r.volunteerId, firstName: r.firstName, lastName: r.lastName, shifts: [] });
    }
    for (const r of assignRows) {
      volMap.get(r.volunteerId)?.shifts.push({
        shiftId: r.shiftId,
        missionTitle: r.missionTitle,
        missionId: r.missionId,
        startAt: r.startAt,
        endAt: r.endAt,
        location: r.shiftLocation ?? null,
        teamName: r.teamName ?? null,
        assignmentStatus: r.assignmentStatus,
        shiftStatus: r.shiftStatus,
      });
    }

    return {
      items: volRows.map((r) => volMap.get(r.volunteerId)!),
      total,
      limit,
      offset,
    };
  }

  // ─── Vue "À faire" ──────────────────────────────────────────────────────────

  async getTodoList(actingUser: SessionUser, query: DashboardQueryDto): Promise<DashboardTodoList> {
    const scope = await this.resolveScope(actingUser);
    const day = this.parseDay(query.date);

    // Helper pour les colonnes communes des shifts todo
    const shiftSelectBase = (qb: SelectQueryBuilder<any>) => {
      qb.select('s.id', 'shiftId')
        .addSelect('m.title', 'missionTitle')
        .addSelect('m.id', 'missionId')
        .addSelect('s.startAt', 'startAt')
        .addSelect('s.endAt', 'endAt')
        .addSelect('s.location', 'location')
        .addSelect('s.capacity', 'capacity')
        .addSelect(
          `(SELECT COUNT(*)::int FROM volunteer_shift_assignments vsa WHERE vsa.shift_id = s.id AND vsa.status != 'CANCELLED')`,
          'activeCount',
        )
        .addSelect(
          `(SELECT COUNT(*)::int FROM volunteer_shift_assignments vsa WHERE vsa.shift_id = s.id AND vsa.status = 'CONFIRMED')`,
          'confirmedCount',
        )
        .where('DATE(s.startAt) <= :day AND DATE(s.endAt) >= :day', { day });
    };

    // Missions obligatoires non terminées
    const mandatoryQb = this.missionsRepo
      .createQueryBuilder('m')
      .leftJoin('m.volunteerTeam', 'vt')
      .select('m.id', 'missionId')
      .addSelect('m.title', 'title')
      .addSelect('vt.name', 'teamName')
      .addSelect('m.location', 'location')
      .addSelect(
        `(SELECT COUNT(*)::int FROM volunteer_shifts s WHERE s.mission_id = m.id AND DATE(s."startAt") <= :day AND DATE(s."endAt") >= :day)`,
        'shiftCount',
      )
      .where("m.status IN ('TODO', 'IN_PROGRESS')")
      .andWhere('m.isOptional = false')
      .andWhere(
        `EXISTS (SELECT 1 FROM volunteer_shifts s WHERE s.mission_id = m.id AND DATE(s."startAt") <= :day AND DATE(s."endAt") >= :day)`,
        { day },
      )
      .orderBy('m.title', 'ASC');
    this.applyScopeFilter(mandatoryQb, scope, 'm', 'vt');

    // Missions facultatives non terminées
    const optionalQb = this.missionsRepo
      .createQueryBuilder('m')
      .leftJoin('m.volunteerTeam', 'vt')
      .select('m.id', 'missionId')
      .addSelect('m.title', 'title')
      .addSelect('vt.name', 'teamName')
      .addSelect('m.location', 'location')
      .addSelect(
        `(SELECT COUNT(*)::int FROM volunteer_shifts s WHERE s.mission_id = m.id AND DATE(s."startAt") <= :day AND DATE(s."endAt") >= :day)`,
        'shiftCount',
      )
      .where("m.status IN ('TODO', 'IN_PROGRESS')")
      .andWhere('m.isOptional = true')
      .andWhere(
        `EXISTS (SELECT 1 FROM volunteer_shifts s WHERE s.mission_id = m.id AND DATE(s."startAt") <= :day AND DATE(s."endAt") >= :day)`,
        { day },
      )
      .orderBy('m.title', 'ASC');
    this.applyScopeFilter(optionalQb, scope, 'm', 'vt');

    // Shifts non commencés (statut TODO)
    const unstartedQb = this.shiftsRepo
      .createQueryBuilder('s')
      .innerJoin('s.mission', 'm')
      .leftJoin('m.volunteerTeam', 'vt');
    shiftSelectBase(unstartedQb);
    unstartedQb.andWhere("s.status = 'TODO'").orderBy('s.startAt', 'ASC');
    this.applyScopeFilter(unstartedQb, scope, 'm', 'vt');

    // Shifts sans effectif confirmé (actifs, non terminaux)
    const withoutConfirmedQb = this.shiftsRepo
      .createQueryBuilder('s')
      .innerJoin('s.mission', 'm')
      .leftJoin('m.volunteerTeam', 'vt');
    shiftSelectBase(withoutConfirmedQb);
    withoutConfirmedQb
      .andWhere("s.status NOT IN ('DONE', 'CANCELLED', 'NOT_DONE')")
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM volunteer_shift_assignments vsa WHERE vsa.shift_id = s.id AND vsa.status = 'CONFIRMED')`,
      )
      .orderBy('s.startAt', 'ASC');
    this.applyScopeFilter(withoutConfirmedQb, scope, 'm', 'vt');

    const [mandatoryMissions, optionalMissions, unstarted, withoutConfirmed] = await Promise.all([
      mandatoryQb.getRawMany<{ missionId: number; title: string; teamName: string | null; location: string | null; shiftCount: number }>(),
      optionalQb.getRawMany<{ missionId: number; title: string; teamName: string | null; location: string | null; shiftCount: number }>(),
      unstartedQb.getRawMany<{ shiftId: number; missionTitle: string; missionId: number; startAt: string; endAt: string; location: string | null; capacity: number | null; activeCount: number; confirmedCount: number }>(),
      withoutConfirmedQb.getRawMany<{ shiftId: number; missionTitle: string; missionId: number; startAt: string; endAt: string; location: string | null; capacity: number | null; activeCount: number; confirmedCount: number }>(),
    ]);

    return {
      mandatoryIncomplete: mandatoryMissions.map((r) => ({
        missionId: r.missionId, title: r.title, teamName: r.teamName ?? null, location: r.location ?? null, shiftCount: r.shiftCount,
      })),
      unstarted: unstarted.map((r) => ({
        shiftId: r.shiftId, missionTitle: r.missionTitle, missionId: r.missionId,
        startAt: r.startAt, endAt: r.endAt, location: r.location ?? null, capacity: r.capacity ?? null,
        activeCount: r.activeCount ?? 0, confirmedCount: r.confirmedCount ?? 0,
      })),
      withoutConfirmedStaff: withoutConfirmed.map((r) => ({
        shiftId: r.shiftId, missionTitle: r.missionTitle, missionId: r.missionId,
        startAt: r.startAt, endAt: r.endAt, location: r.location ?? null, capacity: r.capacity ?? null,
        activeCount: r.activeCount ?? 0, confirmedCount: r.confirmedCount ?? 0,
      })),
      optionalIncomplete: optionalMissions.map((r) => ({
        missionId: r.missionId, title: r.title, teamName: r.teamName ?? null, location: r.location ?? null, shiftCount: r.shiftCount,
      })),
    };
  }

  async exportOperationalData(
    actingUser: SessionUser,
    kind: OperationalExportKind,
    query: OperationalExportQueryDto,
  ): Promise<OperationalExportFile> {
    this.assertExportAuthorization(actingUser);
    const scope = await this.resolveScope(actingUser);
    const effectiveQuery = this.normalizeExportQuery(query, scope);
    const rows = await this.fetchExportRows(scope, kind, effectiveQuery);
    const title = this.kindToLabel(kind);
    const format = effectiveQuery.format ?? 'xlsx';

    const content = this.buildExportContent(title, rows, format);
    return {
      fileName: this.buildExportFileName(kind, format, effectiveQuery),
      contentType: content.contentType,
      body: content.body,
    };
  }

  // ─── Helpers privés ─────────────────────────────────────────────────────────

  private parseDay(date?: string): string {
    const value = date?.trim() ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('date doit respecter le format YYYY-MM-DD');
    }
    return value;
  }

  /**
   * Ajoute les conditions WHERE selon le périmètre du rôle de l'utilisateur.
   * ADMIN, COORDINATOR et VIEWER ont un accès complet (lecture totale).
   * Les rôles HEALTH/ANIMATOR/LOGISTICS sont filtrés par code d'équipe.
   * Les autres bénévoles voient uniquement leurs équipes et missions responsables.
   */
  private applyScopeFilter(
    qb: SelectQueryBuilder<any>,
    scope: ScopeContext,
    missionAlias: string,
    teamAlias: string,
  ): void {
    if (scope.fullAccess || scope.readOnly) return;

    const orParts: string[] = [];
    const params: Record<string, unknown> = {};

    if (scope.actorTeamIds.length > 0) {
      orParts.push(`${missionAlias}.volunteer_team_id IN (:...dashTeamIds)`);
      params['dashTeamIds'] = scope.actorTeamIds;
    }
    if (scope.actorVolunteerId != null) {
      orParts.push(`${missionAlias}.responsible_volunteer_id = :dashActorId`);
      params['dashActorId'] = scope.actorVolunteerId;
    }
    scope.roleScopes.forEach((role, i) => {
      if (role === 'HEALTH') {
        orParts.push(`(UPPER(${teamAlias}.code) LIKE :dashH1_${i} OR UPPER(${teamAlias}.code) LIKE :dashH2_${i})`);
        params[`dashH1_${i}`] = '%HEALTH%';
        params[`dashH2_${i}`] = '%SANTE%';
      } else if (role === 'ANIMATOR') {
        orParts.push(`UPPER(${teamAlias}.code) LIKE :dashA_${i}`);
        params[`dashA_${i}`] = '%ANIM%';
      } else if (role === 'LOGISTICS') {
        orParts.push(`UPPER(${teamAlias}.code) LIKE :dashL_${i}`);
        params[`dashL_${i}`] = '%LOG%';
      }
    });

    if (orParts.length === 0) {
      qb.andWhere('1 = 0');
      return;
    }

    qb.andWhere(`(${orParts.join(' OR ')})`, params);
  }

  private async resolveScope(actingUser: SessionUser): Promise<ScopeContext> {
    const roles = actingUser.roles;
    const fullAccess = roles.includes('ADMIN') || roles.includes('COORDINATOR');
    const readOnly = roles.includes('VIEWER') && !fullAccess;

    const roleScopes: ('HEALTH' | 'ANIMATOR' | 'LOGISTICS')[] = [];
    if (roles.includes('HEALTH')) roleScopes.push('HEALTH');
    if (roles.includes('ANIMATOR')) roleScopes.push('ANIMATOR');
    if (roles.includes('LOGISTICS')) roleScopes.push('LOGISTICS');

    const actorVolunteer = await this.volunteersRepo.findOne({
      where: { user: { id: actingUser.id } } as never,
      relations: { user: true },
    });
    const actorVolunteerId = actorVolunteer?.id ?? null;

    if (!actorVolunteerId) {
      return { actorVolunteerId: null, actorTeamIds: [], fullAccess, readOnly, roleScopes };
    }

    const memberships = await this.membershipsRepo.find({
      where: { volunteerId: actorVolunteerId },
      select: { volunteerTeamId: true },
    });

    return {
      actorVolunteerId,
      actorTeamIds: memberships.map((m) => m.volunteerTeamId),
      fullAccess,
      readOnly,
      roleScopes,
    };
  }

  private assertExportAuthorization(actingUser: SessionUser): void {
    const roles = actingUser.roles;
    if (roles.includes('ADMIN') || roles.includes('COORDINATOR')) return;
    if (roles.includes('VIEWER')) {
      throw new ForbiddenException('Le rôle VIEWER ne dispose pas de permission d’export');
    }
  }

  private normalizeExportQuery(query: OperationalExportQueryDto, scope: ScopeContext): NormalizedOperationalExportQuery {
    const date = (query.date?.trim() || new Date().toISOString().slice(0, 10));
    const dateFrom = query.dateFrom?.trim() || date;
    const dateTo = query.dateTo?.trim() || date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      throw new BadRequestException('dateFrom/dateTo doivent respecter YYYY-MM-DD');
    }
    if (dateFrom > dateTo) {
      throw new BadRequestException('dateFrom doit être antérieure ou égale à dateTo');
    }

    const format = (query.format ?? 'xlsx') as OperationalExportFormat;
    if (!['xlsx', 'print', 'pdf'].includes(format)) {
      throw new BadRequestException('format invalide');
    }

    const volunteerId = query.volunteerId ?? scope.actorVolunteerId ?? undefined;

    return {
      date,
      dateFrom,
      dateTo,
      volunteerTeamId: query.volunteerTeamId,
      volunteerId,
      location: query.location ?? undefined,
      missionStatus: query.missionStatus,
      shiftStatus: query.shiftStatus,
      assignmentStatus: query.assignmentStatus,
      format,
    };
  }

  private async fetchExportRows(
    scope: ScopeContext,
    kind: OperationalExportKind,
    query: NormalizedOperationalExportQuery,
  ): Promise<OperationalExportRow[]> {
    const qb = this.shiftsRepo
      .createQueryBuilder('s')
      .innerJoin('s.mission', 'm')
      .leftJoin('m.volunteerTeam', 'vt')
      .leftJoin('s.assignments', 'a')
      .leftJoin('a.volunteer', 'v')
      .select('m.id', 'missionId')
      .addSelect('m.title', 'missionTitle')
      .addSelect('m.status', 'missionStatus')
      .addSelect('vt.name', 'teamName')
      .addSelect('vt.code', 'teamCode')
      .addSelect('COALESCE(s.location, m.location)', 'location')
      .addSelect('s.id', 'shiftId')
      .addSelect('s.status', 'shiftStatus')
      .addSelect('s.startAt', 'shiftStartAt')
      .addSelect('s.endAt', 'shiftEndAt')
      .addSelect('s.capacity', 'shiftCapacity')
      .addSelect('a.id', 'assignmentId')
      .addSelect('a.status', 'assignmentStatus')
      .addSelect('v.id', 'volunteerId')
      .addSelect('v.firstName', 'volunteerFirstName')
      .addSelect('v.lastName', 'volunteerLastName')
      .where('DATE(s.startAt) >= :fromDate AND DATE(s.startAt) <= :toDate', {
        fromDate: query.dateFrom,
        toDate: query.dateTo,
      });

    this.applyScopeFilter(qb, scope, 'm', 'vt');
    if (query.volunteerTeamId) qb.andWhere('m.volunteer_team_id = :volunteerTeamId', { volunteerTeamId: query.volunteerTeamId });
    if (query.location) qb.andWhere('COALESCE(s.location, m.location) ILIKE :location', { location: `%${query.location}%` });
    if (query.missionStatus) qb.andWhere('m.status = :missionStatus', { missionStatus: query.missionStatus });
    if (query.shiftStatus) qb.andWhere('s.status = :shiftStatus', { shiftStatus: query.shiftStatus });
    if (query.assignmentStatus) qb.andWhere('a.status = :assignmentStatus', { assignmentStatus: query.assignmentStatus });
    if (query.volunteerId) qb.andWhere('a.volunteer_id = :volunteerId', { volunteerId: query.volunteerId });

    if (kind === 'confirmed-assignments') qb.andWhere("a.status = 'CONFIRMED'");
    if (kind === 'provisional-assignments') qb.andWhere("a.status = 'PROVISIONAL'");
    if (kind === 'unfinished-missions') qb.andWhere("m.status != 'DONE'");
    if (kind === 'unfilled-shifts') {
      qb.andWhere("s.status NOT IN ('DONE', 'CANCELLED', 'NOT_DONE')")
        .andWhere(`NOT EXISTS (SELECT 1 FROM volunteer_shift_assignments vsa WHERE vsa.shift_id = s.id AND vsa.status = 'CONFIRMED')`);
    }

    const rows = await qb.orderBy('s.startAt', 'ASC').addOrderBy('m.title', 'ASC').getRawMany<OperationalExportRow>();
    return rows;
  }

  private kindToLabel(kind: OperationalExportKind): string {
    const labels: Record<OperationalExportKind, string> = {
      'global-planning': 'Planning global',
      'team-planning': 'Planning par équipe',
      'volunteer-planning': 'Planning par bénévole',
      'location-planning': 'Planning par lieu',
      'confirmed-assignments': 'Affectations confirmées',
      'provisional-assignments': 'Affectations provisoires',
      'unfilled-shifts': 'Shifts non pourvus',
      'unfinished-missions': 'Missions non terminées',
    };
    return labels[kind];
  }

  private buildExportFileName(
    kind: OperationalExportKind,
    format: OperationalExportFormat,
    query: NormalizedOperationalExportQuery,
  ): string {
    const parts = [kind, `${query.dateFrom}_${query.dateTo}`];
    if (query.volunteerTeamId) parts.push(`team-${query.volunteerTeamId}`);
    if (query.volunteerId) parts.push(`volunteer-${query.volunteerId}`);
    if (query.location) parts.push(query.location.replace(/[^a-z0-9_-]+/gi, '-').replace(/-+/g, '-').toLowerCase());
    return `${parts.join('__')}.${format === 'print' ? 'html' : format}`;
  }

  private buildExportContent(
    title: string,
    rows: OperationalExportRow[],
    format: OperationalExportFormat,
  ): { contentType: string; body: Buffer } {
    if (format === 'print') {
      const htmlRows = rows
        .map(
          (row) => `<tr><td>${row.shiftStartAt}</td><td>${row.shiftEndAt}</td><td>${row.missionTitle}</td><td>${row.teamName ?? ''}</td><td>${row.location ?? ''}</td><td>${row.volunteerFirstName ?? ''} ${row.volunteerLastName ?? ''}</td><td>${row.assignmentStatus ?? ''}</td></tr>`,
        )
        .join('');
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><table border="1"><thead><tr><th>Début</th><th>Fin</th><th>Mission</th><th>Équipe</th><th>Lieu</th><th>Bénévole</th><th>Affectation</th></tr></thead><tbody>${htmlRows}</tbody></table></body></html>`;
      return { contentType: 'text/html; charset=utf-8', body: Buffer.from(html, 'utf-8') };
    }

    const header = 'Début\tFin\tMission\tStatut mission\tÉquipe\tLieu\tShift\tStatut shift\tBénévole\tStatut affectation\n';
    const lines = rows
      .map(
        (row) =>
          `${row.shiftStartAt}\t${row.shiftEndAt}\t${row.missionTitle}\t${row.missionStatus}\t${row.teamName ?? ''}\t${row.location ?? ''}\t${row.shiftId}\t${row.shiftStatus}\t${(row.volunteerFirstName ?? '') + ' ' + (row.volunteerLastName ?? '')}\t${row.assignmentStatus ?? ''}`,
      )
      .join('\n');
    const body = Buffer.from(`${title}\n${header}${lines}`, 'utf-8');

    if (format === 'pdf') {
      return { contentType: 'application/pdf', body };
    }

    return {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body,
    };
  }
}

