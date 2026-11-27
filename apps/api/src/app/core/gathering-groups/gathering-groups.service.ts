import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  GatheringGroup,
  GatheringGroupCategory,
  GatheringGroupManager,
  GatheringGroupTeam,
  GatheringGroupVolunteerTeam,
  GatheringRepartition,
  ProgramSequence,
  ProgramSequenceTrack,
  Team,
  VolunteerTeam,
} from '../entities';
import type { GatheringScopeInfo } from '../auth/access-module.decorator';
import {
  ApplyAssignmentsDto,
  CreateGroupDto,
  CreateRepartitionDto,
  SetManagersDto,
  UpdateGroupDto,
  UpdateRepartitionDto,
} from './gathering-groups.types';

/** Seuil d'alerte « groupe presque complet » (90 % de la capacité). */
const ALMOST_FULL_RATIO = 0.9;

export type GatheringAlert =
  | { kind: 'OVERFLOW'; groupId: number; message: string }
  | { kind: 'ALMOST_FULL'; groupId: number; message: string }
  | { kind: 'TEAM_WITHOUT_TRACK'; groupId: number; teamId: number; message: string }
  | {
      kind: 'SEQUENCE_OVERLAP';
      teamId: number;
      repartitionId: number;
      otherRepartitionId: number;
      message: string;
    };

/** Appartenance d'une équipe à un groupe d'une autre répartition. */
export type OtherMembership = {
  groupId: number;
  groupName: string;
  category: GatheringGroupCategory;
  repartitionId: number;
  repartitionName: string;
};

type GroupGauge = {
  groupId: number;
  jeunes: number;
  animateurs: number;
  persons: number;
  teamCount: number;
  capacity: number | null;
  overflow: boolean;
  almostFull: boolean;
};

@Injectable()
export class GatheringGroupsService {
  constructor(
    @InjectRepository(GatheringRepartition)
    private readonly repartitions: Repository<GatheringRepartition>,
    @InjectRepository(GatheringGroup)
    private readonly groups: Repository<GatheringGroup>,
    @InjectRepository(GatheringGroupTeam)
    private readonly teamLinks: Repository<GatheringGroupTeam>,
    @InjectRepository(GatheringGroupVolunteerTeam)
    private readonly volunteerTeamLinks: Repository<GatheringGroupVolunteerTeam>,
    @InjectRepository(GatheringGroupManager)
    private readonly managerLinks: Repository<GatheringGroupManager>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(ProgramSequence)
    private readonly sequences: Repository<ProgramSequence>,
    @InjectRepository(VolunteerTeam)
    private readonly volunteerTeams: Repository<VolunteerTeam>,
    private readonly dataSource: DataSource,
  ) {}

  // ---- Portée « ses groupes » -----------------------------------------

  private assertRepartitionWritable(scope: GatheringScopeInfo) {
    // Créer, régler ou supprimer une répartition n'est pas une action sur « ses groupes » :
    // il faut la portée « tout » (la nomination des responsables vient après).
    if (!scope.all) {
      throw new ForbiddenException('Portée insuffisante : répartition hors de vos groupes');
    }
  }

  private assertGroupInScope(scope: GatheringScopeInfo, groupId: number) {
    if (!scope.all && !scope.gatheringGroupIds.includes(groupId)) {
      throw new NotFoundException(`Groupe de rassemblement ${groupId} introuvable`);
    }
  }

  private scopeFilter(scope: GatheringScopeInfo): number[] | null {
    return scope.all ? null : scope.gatheringGroupIds;
  }

  // ---- Comptages --------------------------------------------------------

  /** Personnes d'une équipe : jeunes + animateurs (1 ou 2) si le comptage les inclut. */
  private teamPersons(
    team: { jeunes: number; animateurs: number },
    countAnimators: boolean,
  ): number {
    return team.jeunes + (countAnimators ? team.animateurs : 0);
  }

  private async teamSizes(teamIds: number[]): Promise<
    Map<number, { jeunes: number; animateurs: number }>
  > {
    const out = new Map<number, { jeunes: number; animateurs: number }>();
    if (!teamIds.length) return out;
    const rows: { id: number; jeunes: string; animateurs: string }[] = await this.dataSource.query(
      `SELECT t.id,
              COUNT(DISTINCT tp.participant_id) AS jeunes,
              ((CASE WHEN t.primary_animator_id IS NOT NULL THEN 1 ELSE 0 END)
             + (CASE WHEN t.secondary_animator_id IS NOT NULL THEN 1 ELSE 0 END)) AS animateurs
         FROM teams t
         LEFT JOIN team_participants tp ON tp.team_id = t.id
        WHERE t.id = ANY($1::int[])
        GROUP BY t.id`,
      [teamIds],
    );
    for (const row of rows) {
      out.set(row.id, { jeunes: Number(row.jeunes), animateurs: Number(row.animateurs) });
    }
    return out;
  }

  private gauge(
    group: GatheringGroup,
    counts: { jeunes: number; animateurs: number },
    teamCount: number,
    countAnimators: boolean,
  ): GroupGauge {
    const persons = this.teamPersons(counts, countAnimators);
    const capacity = group.capacityPersons;
    const overflow = capacity != null && persons > capacity;
    return {
      groupId: group.id,
      jeunes: counts.jeunes,
      animateurs: counts.animateurs,
      persons,
      teamCount,
      capacity,
      overflow,
      almostFull: capacity != null && !overflow && persons >= ALMOST_FULL_RATIO * capacity,
    };
  }

  private async groupCounts(groupIds: number[]): Promise<{
    byGroup: Map<number, { jeunes: number; animateurs: number; teamCount: number }>;
    teamIds: Map<number, number[]>;
  }> {
    const byGroup = new Map<number, { jeunes: number; animateurs: number; teamCount: number }>();
    const teamIds = new Map<number, number[]>();
    if (!groupIds.length) return { byGroup, teamIds };
    const links = await this.teamLinks.find({ where: { groupId: In(groupIds) } });
    const allTeamIds = [...new Set(links.map((l) => l.teamId))];
    const sizes = await this.teamSizes(allTeamIds);
    for (const groupId of groupIds) {
      const own = links.filter((l) => l.groupId === groupId);
      let jeunes = 0;
      let animateurs = 0;
      for (const link of own) {
        const size = sizes.get(link.teamId) ?? { jeunes: 0, animateurs: 0 };
        jeunes += size.jeunes;
        animateurs += size.animateurs;
      }
      byGroup.set(groupId, { jeunes, animateurs, teamCount: own.length });
      teamIds.set(
        groupId,
        own.map((l) => l.teamId),
      );
    }
    return { byGroup, teamIds };
  }

  // ---- Lecture : page centrale ------------------------------------------

  /**
   * Répartitions visibles : celles liées à un événement du jour demandé, plus les autonomes.
   * Portée « ses groupes » : seuls les groupes gérés sont renvoyés.
   */
  async list(date: string | undefined, scope: GatheringScopeInfo) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date attendue au format YYYY-MM-DD');
    }
    const qb = this.repartitions
      .createQueryBuilder('r')
      .leftJoinAndMapOne('r.programSequence', ProgramSequence, 's', 's.id = r.program_sequence_id')
      .orderBy('r.id', 'ASC');
    if (date) {
      qb.where('s."eventDate" = :date OR r.program_sequence_id IS NULL', { date });
    }
    const repartitions = await qb.getMany();

    const allGroups = repartitions.length
      ? await this.groups.find({
          where: { repartitionId: In(repartitions.map((r) => r.id)) },
          order: { id: 'ASC' },
        })
      : [];
    const filter = this.scopeFilter(scope);
    const groups = filter ? allGroups.filter((g) => filter.includes(g.id)) : allGroups;
    const { byGroup, teamIds } = await this.groupCounts(groups.map((g) => g.id));

    return repartitions.map((r) => {
      const own = groups.filter((g) => g.repartitionId === r.id);
      return {
        id: r.id,
        name: r.name,
        notes: r.notes,
        allowOverflow: r.allowOverflow,
        countAnimators: r.countAnimators,
        programSequenceId: r.programSequenceId,
        sequence: r.programSequence
          ? {
              id: r.programSequence.id,
              title: r.programSequence.title,
              eventDate: r.programSequence.eventDate,
              startTime: r.programSequence.startTime,
              endTime: r.programSequence.endTime,
              track: r.programSequence.track,
              location: r.programSequence.location,
            }
          : null,
        groups: own.map((g) => {
          const counts = byGroup.get(g.id) ?? { jeunes: 0, animateurs: 0, teamCount: 0 };
          const gauge = this.gauge(g, counts, counts.teamCount, r.countAnimators);
          return {
            id: g.id,
            name: g.name,
            category: g.category,
            location: g.location,
            ...gauge,
            teamIds: teamIds.get(g.id) ?? [],
          };
        }),
      };
    });
  }

  // ---- Écriture : répartitions ------------------------------------------

  async createRepartition(dto: CreateRepartitionDto, scope: GatheringScopeInfo) {
    this.assertRepartitionWritable(scope);
    if (!dto.name?.trim()) throw new BadRequestException('Le nom est obligatoire.');
    let sequence: ProgramSequence | null = null;
    if (dto.programSequenceId != null) {
      sequence = await this.sequences.findOneBy({ id: dto.programSequenceId });
      if (!sequence) throw new BadRequestException('Événement de l\'agenda introuvable.');
    }
    const repartition = this.repartitions.create({
      name: dto.name.trim(),
      programSequenceId: sequence?.id ?? null,
      notes: dto.notes ?? null,
    });
    return this.repartitions.save(repartition);
  }

  async updateRepartition(id: number, dto: UpdateRepartitionDto, scope: GatheringScopeInfo) {
    this.assertRepartitionWritable(scope);
    const repartition = await this.findRepartition(id);
    if (dto.name !== undefined) {
      if (!dto.name?.trim()) throw new BadRequestException('Le nom est obligatoire.');
      repartition.name = dto.name.trim();
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'programSequenceId')) {
      if (dto.programSequenceId == null) {
        repartition.programSequenceId = null;
      } else {
        const sequence = await this.sequences.findOneBy({ id: dto.programSequenceId });
        if (!sequence) throw new BadRequestException('Événement de l\'agenda introuvable.');
        repartition.programSequenceId = sequence.id;
      }
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'notes')) {
      repartition.notes = dto.notes ?? null;
    }
    if (dto.countAnimators !== undefined) repartition.countAnimators = dto.countAnimators;
    return this.repartitions.save(repartition);
  }

  /** Dérogation au dépassement bloquant : réservée au niveau Gérer (garde), toujours explicite. */
  async setOverflow(id: number, allowOverflow: boolean, scope: GatheringScopeInfo) {
    this.assertRepartitionWritable(scope);
    const repartition = await this.findRepartition(id);
    repartition.allowOverflow = allowOverflow === true;
    return this.repartitions.save(repartition);
  }

  async removeRepartition(id: number, scope: GatheringScopeInfo) {
    this.assertRepartitionWritable(scope);
    const repartition = await this.findRepartition(id);
    await this.repartitions.remove(repartition);
  }

  /**
   * Duplique la structure d'une répartition (groupes, catégories, capacités, lieux, liens)
   * sans les affectations d'équipes ni les responsables : la nouvelle répartition part vide.
   */
  async duplicateRepartition(id: number, name: string | undefined, scope: GatheringScopeInfo) {
    this.assertRepartitionWritable(scope);
    const source = await this.findRepartition(id);
    const sourceGroups = await this.groups.find({
      where: { repartitionId: id },
      order: { id: 'ASC' },
    });
    return this.dataSource.transaction(async (manager) => {
      const copy = await manager.save(
        manager.create(GatheringRepartition, {
          name: (name?.trim() || `${source.name} (copie)`).slice(0, 150),
          programSequenceId: source.programSequenceId,
          allowOverflow: source.allowOverflow,
          countAnimators: source.countAnimators,
          notes: source.notes,
        }),
      );
      for (const group of sourceGroups) {
        await manager.save(
          manager.create(GatheringGroup, {
            repartitionId: copy.id,
            name: group.name,
            category: group.category,
            capacityPersons: group.capacityPersons,
            location: group.location,
            hostingGroupId: group.hostingGroupId,
            documentLinkId: group.documentLinkId,
            notes: group.notes,
          }),
        );
      }
      return copy;
    });
  }

  // ---- Écriture : groupes -------------------------------------------------

  async createGroup(repartitionId: number, dto: CreateGroupDto, scope: GatheringScopeInfo) {
    this.assertRepartitionWritable(scope);
    await this.findRepartition(repartitionId);
    if (!dto.name?.trim()) throw new BadRequestException('Le nom est obligatoire.');
    this.assertCapacity(dto.capacityPersons);
    const group = this.groups.create({
      repartitionId,
      name: dto.name.trim(),
      category: dto.category ?? GatheringGroupCategory.MIXTE,
      capacityPersons: dto.capacityPersons ?? null,
      location: dto.location ?? null,
      hostingGroupId: dto.hostingGroupId ?? null,
      documentLinkId: dto.documentLinkId ?? null,
      notes: dto.notes ?? null,
    });
    return this.groups.save(group);
  }

  async updateGroup(id: number, dto: UpdateGroupDto, scope: GatheringScopeInfo) {
    this.assertGroupInScope(scope, id);
    const group = await this.findGroup(id);
    if (dto.name !== undefined) {
      if (!dto.name?.trim()) throw new BadRequestException('Le nom est obligatoire.');
      group.name = dto.name.trim();
    }
    if (dto.category !== undefined) group.category = dto.category;
    if (Object.prototype.hasOwnProperty.call(dto, 'capacityPersons')) {
      this.assertCapacity(dto.capacityPersons);
      group.capacityPersons = dto.capacityPersons ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'location'))
      group.location = dto.location ?? null;
    if (Object.prototype.hasOwnProperty.call(dto, 'hostingGroupId'))
      group.hostingGroupId = dto.hostingGroupId ?? null;
    if (Object.prototype.hasOwnProperty.call(dto, 'documentLinkId'))
      group.documentLinkId = dto.documentLinkId ?? null;
    if (Object.prototype.hasOwnProperty.call(dto, 'notes')) group.notes = dto.notes ?? null;
    return this.groups.save(group);
  }

  async removeGroup(id: number, scope: GatheringScopeInfo) {
    this.assertGroupInScope(scope, id);
    const group = await this.findGroup(id);
    await this.groups.remove(group);
  }

  private assertCapacity(capacity?: number | null) {
    if (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) {
      throw new BadRequestException('La capacité est un entier de personnes (1 ou plus).');
    }
  }

  // ---- Dispatch des équipes ----------------------------------------------

  /** Règle des pistes : un groupe TA ou ES n'accepte que les équipes de sa piste. */
  static trackAllowed(category: GatheringGroupCategory, track: ProgramSequenceTrack): boolean {
    if (category === GatheringGroupCategory.MIXTE) return true;
    return String(category) === String(track);
  }

  /**
   * Affecte une équipe entière à un groupe (jamais coupée, un seul groupe par répartition).
   * Dépassement bloquant sauf dérogation explicite sur la répartition.
   */
  async assignTeam(groupId: number, teamId: number, scope: GatheringScopeInfo) {
    this.assertGroupInScope(scope, groupId);
    return this.dataSource.transaction(async (manager) => {
      const group = await manager.findOne(GatheringGroup, { where: { id: groupId } });
      if (!group) throw new NotFoundException(`Groupe de rassemblement ${groupId} introuvable`);
      const team = await manager.findOne(Team, { where: { id: teamId } });
      if (!team) throw new BadRequestException(`Équipe ${teamId} introuvable`);
      if (!GatheringGroupsService.trackAllowed(group.category, team.track)) {
        throw new BadRequestException(
          `L'équipe « ${team.name} » (piste ${team.track}) n'entre pas dans un groupe ${group.category}.`,
        );
      }
      const existing = await manager.findOne(GatheringGroupTeam, {
        where: { teamId, repartitionId: group.repartitionId },
      });
      if (existing && existing.groupId !== groupId) {
        throw new ConflictException(
          `L'équipe « ${team.name} » est déjà dans un autre groupe de cette répartition.`,
        );
      }
      if (existing) return { assigned: true, already: true };
      const repartition = await manager.findOne(GatheringRepartition, {
        where: { id: group.repartitionId },
      });
      await this.assertCapacityRoom(manager, group, repartition!, [teamId], []);
      await manager.save(
        manager.create(GatheringGroupTeam, {
          groupId,
          teamId,
          repartitionId: group.repartitionId,
        }),
      );
      return { assigned: true };
    });
  }

  async unassignTeam(groupId: number, teamId: number, scope: GatheringScopeInfo) {
    this.assertGroupInScope(scope, groupId);
    await this.teamLinks.delete({ groupId, teamId });
    return { removed: true };
  }

  /**
   * Vérifie la capacité après ajout/retrait d'équipes, dans la transaction courante.
   * Bloquant sauf dérogation active sur la répartition.
   */
  private async assertCapacityRoom(
    manager: EntityManager,
    group: GatheringGroup,
    repartition: GatheringRepartition,
    addTeamIds: number[],
    removeTeamIds: number[],
  ) {
    if (group.capacityPersons == null || repartition.allowOverflow) return;
    const links = await manager.find(GatheringGroupTeam, { where: { groupId: group.id } });
    const kept = links.filter((l) => !removeTeamIds.includes(l.teamId)).map((l) => l.teamId);
    const all = [...kept, ...addTeamIds.filter((t) => !kept.includes(t))];
    const sizes = await this.teamSizes(all);
    let persons = 0;
    for (const id of all) {
      const size = sizes.get(id);
      if (size) persons += this.teamPersons(size, repartition.countAnimators);
    }
    if (persons > group.capacityPersons) {
      throw new ConflictException(
        `Dépassement de capacité : ${persons} personnes pour ${group.capacityPersons} places dans « ${group.name} ». ` +
          'Une dérogation peut être activée sur la répartition par un niveau Gérer.',
      );
    }
  }

  /**
   * Autres groupes de rassemblement (hors répartition donnée) dont font partie les équipes.
   * Respecte la portée « ses groupes » : un groupe hors périmètre n'est pas révélé.
   */
  private async otherMemberships(
    teamIds: number[],
    excludeRepartitionId: number,
    filter: number[] | null,
  ): Promise<Map<number, OtherMembership[]>> {
    const out = new Map<number, OtherMembership[]>();
    if (!teamIds.length) return out;
    const rows: {
      teamId: number;
      groupId: number;
      groupName: string;
      category: GatheringGroupCategory;
      repartitionId: number;
      repartitionName: string;
    }[] = await this.dataSource.query(
      `SELECT l.team_id AS "teamId", g.id AS "groupId", g.name AS "groupName", g.category,
              r.id AS "repartitionId", r.name AS "repartitionName"
         FROM gathering_group_teams l
         JOIN gathering_groups g ON g.id = l.group_id
         JOIN gathering_repartitions r ON r.id = g.repartition_id
        WHERE l.team_id = ANY($1::int[]) AND l.repartition_id <> $2
        ORDER BY r.id, g.id`,
      [teamIds, excludeRepartitionId],
    );
    for (const row of rows) {
      if (filter && !filter.includes(row.groupId)) continue;
      const list = out.get(row.teamId) ?? [];
      list.push({
        groupId: row.groupId,
        groupName: row.groupName,
        category: row.category,
        repartitionId: row.repartitionId,
        repartitionName: row.repartitionName,
      });
      out.set(row.teamId, list);
    }
    return out;
  }

  private async otherGroupOptions(excludeRepartitionId: number, filter: number[] | null) {
    const rows: {
      groupId: number;
      groupName: string;
      category: GatheringGroupCategory;
      repartitionId: number;
      repartitionName: string;
    }[] = await this.dataSource.query(
      `SELECT g.id AS "groupId", g.name AS "groupName", g.category,
              r.id AS "repartitionId", r.name AS "repartitionName"
         FROM gathering_groups g JOIN gathering_repartitions r ON r.id = g.repartition_id
        WHERE g.repartition_id <> $1 ORDER BY r.id, g.id`,
      [excludeRepartitionId],
    );
    return rows.filter((r) => !filter || filter.includes(r.groupId));
  }

  /** Données du tableau de dispatch : équipes non placées + groupes avec jauges. */
  async board(repartitionId: number, scope: GatheringScopeInfo) {
    const repartition = await this.findRepartition(repartitionId);
    const filter = this.scopeFilter(scope);
    const allGroups = await this.groups.find({
      where: { repartitionId },
      order: { id: 'ASC' },
    });
    const groups = filter ? allGroups.filter((g) => filter.includes(g.id)) : allGroups;
    const { byGroup, teamIds } = await this.groupCounts(groups.map((g) => g.id));

    const placedLinks = await this.teamLinks.find({ where: { repartitionId } });
    const placedIds = new Set(placedLinks.map((l) => l.teamId));
    const allTeams = await this.teams.find({ order: { name: 'ASC' } });
    const sizes = await this.teamSizes(allTeams.map((t) => t.id));
    const others = await this.otherMemberships(
      allTeams.map((t) => t.id),
      repartitionId,
      filter,
    );
    const unplaced = allTeams
      .filter((t) => !placedIds.has(t.id))
      .map((t) => {
        const size = sizes.get(t.id) ?? { jeunes: 0, animateurs: 0 };
        return {
          id: t.id,
          name: t.name,
          track: t.track,
          jeunes: size.jeunes,
          animateurs: size.animateurs,
          persons: this.teamPersons(size, repartition.countAnimators),
          otherGroups: others.get(t.id) ?? [],
        };
      });

    const placedTeamIds = [...new Set([...teamIds.values()].flat())];
    const placedTeams = placedTeamIds.length
      ? await this.teams.find({ where: { id: In(placedTeamIds) }, order: { name: 'ASC' } })
      : [];
    const placedById = new Map(placedTeams.map((t) => [t.id, t]));

    return {
      repartition: {
        id: repartition.id,
        name: repartition.name,
        allowOverflow: repartition.allowOverflow,
        countAnimators: repartition.countAnimators,
        programSequenceId: repartition.programSequenceId,
      },
      groups: groups.map((g) => {
        const counts = byGroup.get(g.id) ?? { jeunes: 0, animateurs: 0, teamCount: 0 };
        const ownTeamIds = teamIds.get(g.id) ?? [];
        return {
          id: g.id,
          name: g.name,
          category: g.category,
          location: g.location,
          ...this.gauge(g, counts, counts.teamCount, repartition.countAnimators),
          teamIds: ownTeamIds,
          teams: ownTeamIds
            .map((id) => placedById.get(id))
            .filter((t): t is Team => !!t)
            .map((t) => {
              const size = sizes.get(t.id) ?? { jeunes: 0, animateurs: 0 };
              return {
                id: t.id,
                name: t.name,
                track: t.track,
                persons: this.teamPersons(size, repartition.countAnimators),
                otherGroups: others.get(t.id) ?? [],
              };
            }),
        };
      }),
      unplacedTeams: unplaced,
      /** Groupes des autres répartitions, pour filtrer les équipes par leurs autres appartenances. */
      otherGroups: await this.otherGroupOptions(repartitionId, filter),
    };
  }

  /**
   * Proposition automatique de dispatch (aucune écriture) : équipes les plus grosses d'abord,
   * meilleur groupe compatible (piste + place restante). Les équipes qui n'entrent nulle part
   * sont renvoyées avec la raison.
   */
  async propose(repartitionId: number, scope: GatheringScopeInfo) {
    const board = await this.board(repartitionId, scope);
    const repartition = await this.findRepartition(repartitionId);
    const groups = board.groups.map((g) => ({
      ...g,
      remaining: g.capacity == null ? Number.POSITIVE_INFINITY : g.capacity - g.persons,
    }));
    const teams = [...board.unplacedTeams].sort((a, b) => b.persons - a.persons || a.id - b.id);
    const assignments: { teamId: number; groupId: number; groupName: string }[] = [];
    const unplaced: { teamId: number; teamName: string; reason: string }[] = [];
    for (const team of teams) {
      const candidates = groups
        .filter((g) => GatheringGroupsService.trackAllowed(g.category, team.track))
        .filter((g) => team.persons <= g.remaining || repartition.allowOverflow)
        .sort((a, b) => a.remaining - b.remaining || a.id - b.id);
      const target = candidates[0];
      if (!target) {
        unplaced.push({
          teamId: team.id,
          teamName: team.name,
          reason: groups.some((g) => GatheringGroupsService.trackAllowed(g.category, team.track))
            ? 'Capacité insuffisante dans les groupes compatibles'
            : 'Aucun groupe de sa piste',
        });
        continue;
      }
      assignments.push({ teamId: team.id, groupId: target.id, groupName: target.name });
      target.remaining -= team.persons;
    }
    return { assignments, unplaced };
  }

  /** Applique un ensemble d'affectations en une transaction (groupId null = retirer). */
  async apply(repartitionId: number, dto: ApplyAssignmentsDto, scope: GatheringScopeInfo) {
    if (!Array.isArray(dto.assignments) || dto.assignments.length === 0) {
      throw new BadRequestException('Aucune affectation à appliquer.');
    }
    return this.dataSource.transaction(async (manager) => {
      const repartition = await manager.findOne(GatheringRepartition, {
        where: { id: repartitionId },
      });
      if (!repartition) throw new NotFoundException(`Répartition ${repartitionId} introuvable`);
      const groups = await manager.find(GatheringGroup, { where: { repartitionId } });
      const byId = new Map(groups.map((g) => [g.id, g]));
      // Simule l'état final par groupe pour le contrôle de capacité.
      const links = await manager.find(GatheringGroupTeam, { where: { repartitionId } });
      const finalTeams = new Map<number, number[]>();
      for (const g of groups) {
        finalTeams.set(
          g.id,
          links.filter((l) => l.groupId === g.id).map((l) => l.teamId),
        );
      }
      const seen = new Set<number>();
      for (const change of dto.assignments) {
        if (!Number.isInteger(change.teamId)) {
          throw new BadRequestException('teamId invalide.');
        }
        if (seen.has(change.teamId)) {
          throw new BadRequestException(`L'équipe ${change.teamId} apparaît deux fois.`);
        }
        seen.add(change.teamId);
        if (change.groupId == null) {
          for (const [gid, list] of finalTeams) {
            finalTeams.set(
              gid,
              list.filter((t) => t !== change.teamId),
            );
          }
          continue;
        }
        const group = byId.get(change.groupId);
        if (!group) {
          throw new BadRequestException(`Groupe ${change.groupId} hors de cette répartition.`);
        }
        if (!scope.all && !scope.gatheringGroupIds.includes(change.groupId)) {
          throw new NotFoundException(`Groupe de rassemblement ${change.groupId} introuvable`);
        }
        const team = await manager.findOne(Team, { where: { id: change.teamId } });
        if (!team) throw new BadRequestException(`Équipe ${change.teamId} introuvable`);
        if (!GatheringGroupsService.trackAllowed(group.category, team.track)) {
          throw new BadRequestException(
            `L'équipe « ${team.name} » (piste ${team.track}) n'entre pas dans un groupe ${group.category}.`,
          );
        }
        for (const [gid, list] of finalTeams) {
          finalTeams.set(
            gid,
            list.filter((t) => t !== change.teamId),
          );
        }
        finalTeams.get(change.groupId)!.push(change.teamId);
      }
      // Contrôle de capacité sur l'état final (bloquant sauf dérogation).
      if (!repartition.allowOverflow) {
        for (const group of groups) {
          if (group.capacityPersons == null) continue;
          const ids = finalTeams.get(group.id) ?? [];
          const sizes = await this.teamSizes(ids);
          let persons = 0;
          for (const id of ids) {
            const size = sizes.get(id);
            if (size) persons += this.teamPersons(size, repartition.countAnimators);
          }
          if (persons > group.capacityPersons) {
            throw new ConflictException(
              `Dépassement de capacité : ${persons} personnes pour ${group.capacityPersons} places dans « ${group.name} ». ` +
                'Une dérogation peut être activée sur la répartition par un niveau Gérer.',
            );
          }
        }
      }
      // Écrit l'état final.
      for (const change of dto.assignments) {
        await manager.delete(GatheringGroupTeam, { teamId: change.teamId, repartitionId });
        if (change.groupId != null) {
          await manager.save(
            manager.create(GatheringGroupTeam, {
              groupId: change.groupId,
              teamId: change.teamId,
              repartitionId,
            }),
          );
        }
      }
      return { applied: dto.assignments.length };
    });
  }

  // ---- Équipes opérationnelles rattachées (section distincte) -------------

  async attachVolunteerTeam(groupId: number, volunteerTeamId: number, scope: GatheringScopeInfo) {
    this.assertGroupInScope(scope, groupId);
    await this.findGroup(groupId);
    const team = await this.volunteerTeams.findOneBy({ id: volunteerTeamId });
    if (!team) throw new BadRequestException('Équipe opérationnelle introuvable.');
    const existing = await this.volunteerTeamLinks.findOneBy({ groupId, volunteerTeamId });
    if (existing) return { attached: true, already: true };
    await this.volunteerTeamLinks.save(
      this.volunteerTeamLinks.create({ groupId, volunteerTeamId }),
    );
    return { attached: true };
  }

  async detachVolunteerTeam(groupId: number, volunteerTeamId: number, scope: GatheringScopeInfo) {
    this.assertGroupInScope(scope, groupId);
    await this.volunteerTeamLinks.delete({ groupId, volunteerTeamId });
    return { detached: true };
  }

  // ---- Responsables (périmètre « ses groupes ») -----------------------------

  async listManagers(groupId: number, scope: GatheringScopeInfo) {
    this.assertGroupInScope(scope, groupId);
    const rows: { user_id: number; email: string; display_name: string | null }[] =
      await this.dataSource.query(
        `SELECT m.user_id, u.email,
                NULLIF(TRIM(v."firstName" || ' ' || v."lastName"), '') AS display_name
           FROM gathering_group_managers m
           JOIN users u ON u.id = m.user_id
           LEFT JOIN volunteers v ON v.user_id = u.id
          WHERE m.group_id = $1 ORDER BY u.email`,
        [groupId],
      );
    return rows.map((r) => ({ userId: r.user_id, email: r.email, displayName: r.display_name }));
  }

  /** Remplace la liste des responsables : la nomination fixe le périmètre, pas le niveau. */
  async setManagers(groupId: number, dto: SetManagersDto, scope: GatheringScopeInfo) {
    this.assertGroupInScope(scope, groupId);
    await this.findGroup(groupId);
    if (!Array.isArray(dto.userIds) || dto.userIds.some((id) => !Number.isInteger(id))) {
      throw new BadRequestException('userIds doit être une liste d’entiers.');
    }
    const unique = [...new Set(dto.userIds)];
    if (unique.length) {
      const found: { id: number }[] = await this.dataSource.query(
        `SELECT id FROM users WHERE id = ANY($1::int[])`,
        [unique],
      );
      if (found.length !== unique.length) throw new BadRequestException('Compte introuvable.');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(GatheringGroupManager, { groupId });
      for (const userId of unique) {
        await manager.save(manager.create(GatheringGroupManager, { groupId, userId }));
      }
    });
    return this.listManagers(groupId, scope);
  }

  // ---- Fiche groupe ---------------------------------------------------------

  async fiche(groupId: number, scope: GatheringScopeInfo) {
    this.assertGroupInScope(scope, groupId);
    const group = await this.groups.findOne({
      where: { id: groupId },
      relations: { hostingGroup: true, documentLink: true },
    });
    if (!group) throw new NotFoundException(`Groupe de rassemblement ${groupId} introuvable`);
    const repartition = await this.findRepartition(group.repartitionId);
    const sequence = repartition.programSequenceId
      ? await this.sequences.findOneBy({ id: repartition.programSequenceId })
      : null;

    const links = await this.teamLinks.find({ where: { groupId } });
    const teamIds = links.map((l) => l.teamId);
    const teams = teamIds.length
      ? await this.teams.find({
          where: { id: In(teamIds) },
          relations: { primaryAnimator: true, secondaryAnimator: true },
          order: { name: 'ASC' },
        })
      : [];
    // Personnes dérivées des équipes (source unique). La fiche est déjà limitée au périmètre
    // du compte (GatheringScope) : on affiche les membres de ses propres groupes.
    const people: {
      id: number;
      firstName: string;
      lastName: string;
      teamId: number;
      teamName: string;
      mejAgeGroup: string | null;
    }[] = teamIds.length
      ? await this.dataSource.query(
          `SELECT p.id, p."firstName" AS "firstName", p."lastName" AS "lastName", t.id AS "teamId", t.name AS "teamName",
                  p."mejAgeGroup" AS "mejAgeGroup"
             FROM team_participants tp
             JOIN participants p ON p.id = tp.participant_id
             JOIN teams t ON t.id = tp.team_id
            WHERE tp.team_id = ANY($1::int[])
            ORDER BY t.name, p."lastName", p."firstName", p.id`,
          [teamIds],
        )
      : [];
    const animators = teams.flatMap((t) =>
      [t.primaryAnimator, t.secondaryAnimator]
        .filter((a): a is NonNullable<typeof a> => !!a)
        .map((a) => ({
          id: a.id,
          displayName: `${a.firstName} ${a.lastName}`.trim(),
          teamId: t.id,
          teamName: t.name,
        })),
    );

    const volunteerLinks = await this.volunteerTeamLinks.find({ where: { groupId } });
    const volunteerTeams = volunteerLinks.length
      ? await this.dataSource.query(
          `SELECT vt.id, vt.name, t.label AS "typeLabel",
                  (SELECT COUNT(*) FROM volunteer_team_memberships m
                    WHERE m.volunteer_team_id = vt.id
                      AND (m."startAt" IS NULL OR m."startAt" <= CURRENT_DATE)
                      AND (m."endAt" IS NULL OR m."endAt" >= CURRENT_DATE))::int AS "memberCount"
             FROM gathering_group_volunteer_teams l
             JOIN volunteer_teams vt ON vt.id = l.volunteer_team_id
             LEFT JOIN volunteer_team_types t ON t.id = vt.type_id
            WHERE l.group_id = $1 ORDER BY vt.name`,
          [groupId],
        )
      : [];

    const teamSizesMap = await this.teamSizes(teamIds);
    const { byGroup } = await this.groupCounts([groupId]);
    const counts = byGroup.get(groupId) ?? { jeunes: 0, animateurs: 0, teamCount: 0 };
    const gauge = this.gauge(group, counts, counts.teamCount, repartition.countAnimators);

    return {
      id: group.id,
      name: group.name,
      category: group.category,
      location: group.location,
      notes: group.notes,
      ...gauge,
      repartition: {
        id: repartition.id,
        name: repartition.name,
        allowOverflow: repartition.allowOverflow,
        countAnimators: repartition.countAnimators,
      },
      sequence: sequence
        ? {
            id: sequence.id,
            title: sequence.title,
            eventDate: sequence.eventDate,
            startTime: sequence.startTime,
            endTime: sequence.endTime,
            track: sequence.track,
            location: sequence.location,
          }
        : null,
      hostingGroup: group.hostingGroup
        ? { id: group.hostingGroup.id, name: group.hostingGroup.name }
        : null,
      documentLink: group.documentLink
        ? { id: group.documentLink.id, title: group.documentLink.title, url: group.documentLink.url }
        : null,
      teams: teams.map((t) => {
        const size = teamSizesMap.get(t.id) ?? { jeunes: 0, animateurs: 0 };
        return {
          id: t.id,
          name: t.name,
          track: t.track,
          ...size,
          persons: this.teamPersons(size, repartition.countAnimators),
        };
      }),
      people,
      animators,
      volunteerTeams,
      managers: await this.listManagers(groupId, scope),
      alerts: await this.alertsForRepartition(repartition.id),
    };
  }

  // ---- Alertes ----------------------------------------------------------------

  /**
   * Alertes d'une répartition : dépassement, groupe presque complet, équipe sans piste
   * renseignée, et chevauchement d'horaires quand une même équipe est dans deux
   * répartitions liées à des événements de l'agenda qui se chevauchent.
   */
  async alertsForRepartition(repartitionId: number): Promise<GatheringAlert[]> {
    const repartition = await this.findRepartition(repartitionId);
    const groups = await this.groups.find({ where: { repartitionId } });
    const { byGroup, teamIds } = await this.groupCounts(groups.map((g) => g.id));
    const alerts: GatheringAlert[] = [];
    for (const group of groups) {
      const counts = byGroup.get(group.id) ?? { jeunes: 0, animateurs: 0, teamCount: 0 };
      const gauge = this.gauge(group, counts, counts.teamCount, repartition.countAnimators);
      if (gauge.overflow) {
        alerts.push({
          kind: 'OVERFLOW',
          groupId: group.id,
          message: `« ${group.name} » dépasse sa capacité : ${gauge.persons} personnes pour ${gauge.capacity} places.`,
        });
      } else if (gauge.almostFull) {
        alerts.push({
          kind: 'ALMOST_FULL',
          groupId: group.id,
          message: `« ${group.name} » est presque complet : ${gauge.persons}/${gauge.capacity}.`,
        });
      }
    }
    const assignedTeamIds = [...new Set([...teamIds.values()].flat())];
    if (assignedTeamIds.length) {
      const teams = await this.teams.find({ where: { id: In(assignedTeamIds) } });
      for (const team of teams) {
        if (team.track === ProgramSequenceTrack.COMMON) {
          const groupId = [...teamIds.entries()].find(([, ids]) =>
            ids.includes(team.id),
          )?.[0];
          alerts.push({
            kind: 'TEAM_WITHOUT_TRACK',
            groupId: groupId ?? 0,
            teamId: team.id,
            message: `L'équipe « ${team.name} » n'a pas de piste renseignée (TA ou ES).`,
          });
        }
      }
      // Chevauchement : même équipe dans une autre répartition liée à un événement qui
      // chevauche celui de cette répartition (détectable seulement avec un horaire).
      const overlaps: {
        team_id: number;
        other_repartition_id: number;
        other_name: string;
      }[] = await this.dataSource.query(
        `SELECT DISTINCT l2.team_id, r2.id AS other_repartition_id, r2.name AS other_name
           FROM gathering_group_teams l1
           JOIN gathering_repartitions r1 ON r1.id = l1.repartition_id
           JOIN program_sequences s1 ON s1.id = r1.program_sequence_id
           JOIN gathering_group_teams l2 ON l2.team_id IN (SELECT team_id FROM gathering_group_teams WHERE repartition_id = $1)
           JOIN gathering_repartitions r2 ON r2.id = l2.repartition_id AND r2.id <> $1
           JOIN program_sequences s2 ON s2.id = r2.program_sequence_id
          WHERE l1.repartition_id = $1
            AND s2."eventDate" = s1."eventDate"
            AND s2."startTime" < s1."endTime" AND s1."startTime" < s2."endTime"`,
        [repartitionId],
      );
      for (const row of overlaps) {
        alerts.push({
          kind: 'SEQUENCE_OVERLAP',
          teamId: row.team_id,
          repartitionId,
          otherRepartitionId: row.other_repartition_id,
          message: `Une équipe est aussi dans « ${row.other_name} », dont l'événement chevauche celui-ci.`,
        });
      }
    }
    return alerts;
  }

  /** Répartitions rattachées à un événement de l'agenda (fiche événement, planning). */
  async forSequence(sequenceId: number, scope: GatheringScopeInfo) {
    const repartitions = await this.repartitions.find({
      where: { programSequenceId: sequenceId },
      order: { id: 'ASC' },
    });
    const filter = this.scopeFilter(scope);
    const groups = repartitions.length
      ? await this.groups.find({ where: { repartitionId: In(repartitions.map((r) => r.id)) } })
      : [];
    const visible = filter ? groups.filter((g) => filter.includes(g.id)) : groups;
    const { byGroup } = await this.groupCounts(visible.map((g) => g.id));
    return repartitions.map((r) => ({
      id: r.id,
      name: r.name,
      allowOverflow: r.allowOverflow,
      countAnimators: r.countAnimators,
      groups: visible
        .filter((g) => g.repartitionId === r.id)
        .map((g) => {
          const counts = byGroup.get(g.id) ?? { jeunes: 0, animateurs: 0, teamCount: 0 };
          return {
            id: g.id,
            name: g.name,
            category: g.category,
            location: g.location,
            ...this.gauge(g, counts, counts.teamCount, r.countAnimators),
          };
        }),
    }));
  }

  private async findRepartition(id: number): Promise<GatheringRepartition> {
    const repartition = await this.repartitions.findOneBy({ id });
    if (!repartition) throw new NotFoundException(`Répartition ${id} introuvable`);
    return repartition;
  }

  private async findGroup(id: number): Promise<GatheringGroup> {
    const group = await this.groups.findOneBy({ id });
    if (!group) throw new NotFoundException(`Groupe de rassemblement ${id} introuvable`);
    return group;
  }
}
