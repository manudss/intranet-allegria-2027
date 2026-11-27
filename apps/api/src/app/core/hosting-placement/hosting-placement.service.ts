import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AccessScopeInfo } from '../auth/access-module.decorator';
import { AccessRightsService } from '../access-rights/access-rights.service';
import { isTeamInScope, isTeamWritableInScope } from '../teams/team-scope';
import { EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import {
  AssignmentStatus,
  HostFamily,
  HostFamilyStatus,
  HostingGroup,
  Participant,
  ParticipantHostFamilyAssignment,
  PersonType,
  Team,
  TeamParticipant,
  HostingGroupKind,
  AccommodationType,
} from '../entities';
import {
  AssignToGroupDto,
  AutoPlaceDto,
  AutoPlaceResponse,
  BoardMember,
  BoardResponse,
  HostingGroupDto,
  PlaceParticipantDto,
  PlacementRulesDto,
} from './hosting-placement.types';
import {
  DEFAULT_PLACEMENT_RULES,
  PlacementFamily,
  PlacementOccupant,
  PlacementPerson,
  PlacementRules,
  proposePlacement,
  refusalReason,
} from './placement.algorithm';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const REASON_MESSAGES: Record<string, string> = {
  NO_CAPACITY: 'La famille est complète sur ces dates',
  UNDER18_LIMIT: 'Limite de mineurs de la famille atteinte',
  ANIMATOR_LIMIT: "Limite d'animateurs de la famille atteinte",
  SEX_MIXING: 'Mixité filles/garçons refusée par la règle choisie',
};

export function resolveRules(dto?: PlacementRulesDto): PlacementRules {
  return {
    countAnimatorsInCapacity:
      dto?.countAnimatorsInCapacity ?? DEFAULT_PLACEMENT_RULES.countAnimatorsInCapacity,
    sexMixing: dto?.sexMixing ?? DEFAULT_PLACEMENT_RULES.sexMixing,
  };
}

export function assertStay(arrival: string | undefined, departure: string | undefined) {
  if (!arrival || !departure || !ISO_DATE.test(arrival) || !ISO_DATE.test(departure)) {
    throw new BadRequestException('Dates de séjour requises au format AAAA-MM-JJ');
  }
  if (departure < arrival) {
    throw new BadRequestException("La date de départ précède la date d'arrivée");
  }
}

/** Mineur à la date d'arrivée du séjour. */
export function isUnder18At(dateOfBirth: string, referenceDate: string): boolean {
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  const eighteenth = `${String(y + 18).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return eighteenth > referenceDate;
}

const dateOnly = (value: Date | string | null | undefined): string | undefined =>
  value ? (typeof value === 'string' ? value : value.toISOString()).slice(0, 10) : undefined;

@Injectable()
export class HostingPlacementService {
  constructor(
    @InjectRepository(HostingGroup)
    private readonly groups: Repository<HostingGroup>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(HostFamily)
    private readonly families: Repository<HostFamily>,
    @InjectRepository(TeamParticipant)
    private readonly teamParticipants: Repository<TeamParticipant>,
    @InjectRepository(ParticipantHostFamilyAssignment)
    private readonly assignments: Repository<ParticipantHostFamilyAssignment>,
    private readonly accessRights: AccessRightsService,
  ) {}

  // ── Groupes d'hébergement ──────────────────────────────────────────────────

  createGroup(dto: HostingGroupDto): Promise<HostingGroup> {
    if (!dto.name?.trim()) throw new BadRequestException('Nom requis');
    return this.groups.save(
      this.groups.create({
        name: dto.name.trim(),
        notes: dto.notes ?? null,
        kind: this.checkKind(dto.kind) ?? HostingGroupKind.OTHER,
        color: this.checkColor(dto.color) ?? null,
      }),
    );
  }

  async updateGroup(id: number, dto: Partial<HostingGroupDto>): Promise<HostingGroup> {
    const group = await this.findGroup(id);
    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new BadRequestException('Nom requis');
      group.name = dto.name.trim();
    }
    if (dto.notes !== undefined) group.notes = dto.notes ?? null;
    if (dto.kind !== undefined) group.kind = this.checkKind(dto.kind) ?? group.kind;
    if (dto.color !== undefined) group.color = this.checkColor(dto.color) ?? null;
    return this.groups.save(group);
  }

  /** Liste légère des groupes (carte, listes) : type, couleur, nombre de familles et de places. */
  async listGroups(): Promise<
    { id: number; name: string; notes: string | null; kind: HostingGroupKind; color: string | null; familyCount: number; seats: number; collectiveCount: number }[]
  > {
    const [groups, families] = await Promise.all([
      this.groups.find({ order: { name: 'ASC' } }),
      this.families.find({ where: { hostingGroup: Not(IsNull()) }, relations: { hostingGroup: true } }),
    ]);
    return groups.map((g) => {
      const list = families.filter((f) => f.hostingGroup?.id === g.id);
      return {
        id: g.id,
        name: g.name,
        notes: g.notes,
        kind: g.kind,
        color: g.color,
        familyCount: list.length,
        seats: list.reduce((n, f) => n + f.maxCapacity, 0),
        collectiveCount: list.filter((f) => f.accommodationType === AccommodationType.COLLECTIVE).length,
      };
    });
  }

  private checkKind(kind: HostingGroupKind | undefined): HostingGroupKind | undefined {
    if (kind === undefined) return undefined;
    if (!Object.values(HostingGroupKind).includes(kind)) throw new BadRequestException('Type de groupe inconnu');
    return kind;
  }

  private checkColor(color: string | null | undefined): string | null | undefined {
    if (color === undefined || color === null) return color;
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new BadRequestException('Couleur attendue au format #rrggbb');
    return color.toLowerCase();
  }

  /** Affecte plusieurs familles d'un coup. Tout ou rien : une famille qui accueille déjà des gens dans un autre groupe bloque l'opération. */
  async setFamiliesGroup(dto: { familyIds: number[]; hostingGroupId: number | null }): Promise<{ updated: number; hostingGroupId: number | null }> {
    const ids = [...new Set(dto.familyIds ?? [])];
    if (ids.length === 0) throw new BadRequestException('Aucune famille sélectionnée');
    const hostingGroupId = dto.hostingGroupId ?? null;
    if (hostingGroupId !== null) await this.findGroup(hostingGroupId);
    return this.families.manager.transaction(async (manager) => {
      const rows = await manager
        .getRepository(HostFamily)
        .createQueryBuilder('f')
        .setLock('pessimistic_write')
        .where('f.id IN (:...ids)', { ids })
        .getMany();
      if (rows.length !== ids.length) throw new NotFoundException('Une ou plusieurs familles sont introuvables');
      const moving = rows.filter((f) => f.hostingGroupId !== null && f.hostingGroupId !== hostingGroupId);
      if (moving.length > 0) {
        const busy = await manager
          .getRepository(ParticipantHostFamilyAssignment)
          .createQueryBuilder('a')
          .where('a.host_family_id IN (:...mids)', { mids: moving.map((f) => f.id) })
          .andWhere('a.status != :cancelled', { cancelled: AssignmentStatus.CANCELLED })
          .getCount();
        if (busy > 0) {
          throw new ConflictException(
            `Des familles sélectionnées accueillent déjà ${busy} personne(s) dans un autre groupe : retirez-les avant de changer leur groupe`,
          );
        }
      }
      await manager
        .createQueryBuilder()
        .update(HostFamily)
        .set({ hostingGroup: hostingGroupId === null ? null : ({ id: hostingGroupId } as HostingGroup) })
        .where('id IN (:...ids)', { ids })
        .execute();
      return { updated: ids.length, hostingGroupId };
    });
  }

  /** Crée un groupe (type paroisse) par paroisse et y range uniquement les familles qui n'ont pas encore de groupe. Ne déplace rien. */
  async groupFromParishes(dto: { parishes?: string[] }): Promise<{ groups: { id: number; name: string; created: boolean; families: number }[] }> {
    const wanted = dto.parishes?.length ? new Set(dto.parishes.map((p) => p.trim())) : null;
    const free = (await this.families.find({ where: { hostingGroup: IsNull() } })).filter(
      (f) => f.parish && f.parish.trim() && (!wanted || wanted.has(f.parish.trim())),
    );
    const byParish = new Map<string, HostFamily[]>();
    for (const f of free) byParish.set(f.parish!.trim(), [...(byParish.get(f.parish!.trim()) ?? []), f]);
    const out: { id: number; name: string; created: boolean; families: number }[] = [];
    for (const [parish, list] of byParish) {
      // On ne réutilise qu'un groupe de type paroisse du même nom : un groupe zone/autre homonyme n'est jamais fusionné.
      const existing = await this.groups.findOneBy({ name: parish, kind: HostingGroupKind.PARISH });
      const sameName = existing ? null : await this.groups.findOneBy({ name: parish });
      const group =
        existing ??
        (await this.groups.save(
          this.groups.create({ name: sameName ? `${parish} (paroisse)` : parish, notes: null, kind: HostingGroupKind.PARISH, color: null }),
        ));
      await this.setFamiliesGroup({ familyIds: list.map((f) => f.id), hostingGroupId: group.id });
      out.push({ id: group.id, name: group.name, created: !existing, families: list.length });
    }
    return { groups: out };
  }

  async removeGroup(id: number): Promise<void> {
    const group = await this.findGroup(id);
    const placed = await this.countPlacedInGroup(id);
    if (placed > 0) {
      throw new ConflictException(
        `${placed} personne(s) sont placées dans ce groupe : retirez-les des familles d'abord`,
      );
    }
    await this.groups.remove(group);
  }

  private async findGroup(id: number): Promise<HostingGroup> {
    const group = await this.groups.findOneBy({ id });
    if (!group) throw new NotFoundException(`Groupe d'hébergement ${id} introuvable`);
    return group;
  }

  private countPlacedInGroup(groupId: number): Promise<number> {
    return this.assignments
      .createQueryBuilder('a')
      .innerJoin('a.hostFamily', 'f')
      .where('f.hosting_group_id = :groupId', { groupId })
      .andWhere('a.status != :cancelled', { cancelled: AssignmentStatus.CANCELLED })
      .getCount();
  }

  async setTeamGroup(teamId: number, dto: AssignToGroupDto): Promise<{ teamId: number; hostingGroupId: number | null }> {
    const team = await this.teams.findOneBy({ id: teamId });
    if (!team) throw new NotFoundException(`Equipe ${teamId} introuvable`);
    const hostingGroupId = dto.hostingGroupId ?? null;
    if (hostingGroupId !== null) await this.findGroup(hostingGroupId);
    const current = (await this.teams.findOne({ where: { id: teamId }, relations: { hostingGroup: true } }))?.hostingGroup?.id ?? null;
    // Premier rattachement (groupe actuel vide) : autorise, les incoherences avec des placements existants sont listees dans le bandeau de conflits.
    if (current !== null && current !== hostingGroupId) {
      const placed = await this.assignments
        .createQueryBuilder('a')
        .innerJoin('a.participant', 'p')
        .innerJoin('p.teamMemberships', 'tm')
        .where('tm.team_id = :teamId', { teamId })
        .andWhere('a.status != :cancelled', { cancelled: AssignmentStatus.CANCELLED })
        .getCount();
      if (placed > 0) {
        throw new ConflictException(
          `${placed} personne(s) de cette équipe sont déjà placées en famille : retirez-les avant de changer de groupe`,
        );
      }
    }
    await this.teams
      .createQueryBuilder()
      .update(Team)
      .set({ hostingGroup: hostingGroupId === null ? null : ({ id: hostingGroupId } as HostingGroup) })
      .where('id = :teamId', { teamId })
      .execute();
    return { teamId, hostingGroupId };
  }

  async setFamilyGroup(familyId: number, dto: AssignToGroupDto): Promise<{ familyId: number; hostingGroupId: number | null }> {
    const family = await this.families.findOne({ where: { id: familyId }, relations: { hostingGroup: true } });
    if (!family) throw new NotFoundException(`Famille ${familyId} introuvable`);
    const hostingGroupId = dto.hostingGroupId ?? null;
    if (hostingGroupId !== null) await this.findGroup(hostingGroupId);
    const currentFamilyGroup = family.hostingGroup?.id ?? null;
    if (currentFamilyGroup !== null && currentFamilyGroup !== hostingGroupId) {
      const active = await this.assignments
        .createQueryBuilder('a')
        .where('a.host_family_id = :familyId', { familyId })
        .andWhere('a.status != :cancelled', { cancelled: AssignmentStatus.CANCELLED })
        .getCount();
      if (active > 0) {
        throw new ConflictException(
          `Cette famille accueille déjà ${active} personne(s) : retirez-les avant de changer son groupe`,
        );
      }
    }
    await this.families
      .createQueryBuilder()
      .update(HostFamily)
      .set({ hostingGroup: hostingGroupId === null ? null : ({ id: hostingGroupId } as HostingGroup) })
      .where('id = :familyId', { familyId })
      .execute();
    return { familyId, hostingGroupId };
  }

  // ── Vue d'ensemble pour l'interface ────────────────────────────────────────

  /**
   * Vue placement. Les données nominatives (jeunes, conflits) sont filtrées par groupe ;
   * les effectifs d'équipe et les familles restent globaux (comptages sans identité),
   * car la capacité d'une famille dépend de tous les jeunes placés.
   */
  async board(scope: AccessScopeInfo = { all: false, groupIds: [] }): Promise<BoardResponse> {
    const [hostingGroups, teams, memberships, families, assignments] = await Promise.all([
      this.groups.find({ order: { name: 'ASC' } }),
      this.teams.find({
        relations: { hostingGroup: true, members: { participant: { group: true } } },
        order: { name: 'ASC' },
      }),
      this.teamParticipants.find({ relations: { team: true, participant: true } }),
      this.families.find({ relations: { hostingGroup: true }, order: { familyName: 'ASC' } }),
      this.assignments.find({
        where: {},
        relations: { participant: true, hostFamily: true },
      }),
    ]);
    const active = new Map<number, ParticipantHostFamilyAssignment>();
    for (const a of assignments) {
      if (a.status !== AssignmentStatus.CANCELLED) active.set(a.participant.id, a);
    }
    const teamGroup = new Map(teams.map((t) => [t.id, t.hostingGroup?.id ?? null]));
    const familyGroup = new Map(families.map((f) => [f.id, f.hostingGroup?.id ?? null]));

    const showOtherTeams =
      scope.all || (await this.accessRights.getOption('GROUP_SCOPE_SHOW_OTHER_TEAMS'));
    const visible = await this.accessRights.participantIdsInScope(
      scope,
      memberships.map((m) => m.participant.id),
    );
    const allMembers: BoardMember[] = memberships.map((m) => {
      const a = active.get(m.participant.id);
      return {
        participantId: m.participant.id,
        firstName: m.participant.firstName,
        lastName: m.participant.lastName,
        sex: m.participant.sex,
        type: m.participant.type,
        dateOfBirth: m.participant.dateOfBirth,
        teamId: m.team.id,
        assignmentId: a?.id ?? null,
        hostFamilyId: a?.hostFamily.id ?? null,
        assignmentStatus: a?.status ?? null,
      };
    });

    const members = allMembers.filter((m) => visible.has(m.participantId));
    const conflicts: BoardResponse['conflicts'] = [];
    for (const m of members) {
      if (m.hostFamilyId === null) continue;
      const tg = teamGroup.get(m.teamId) ?? null;
      const fg = familyGroup.get(m.hostFamilyId) ?? null;
      if (tg === null) {
        conflicts.push({ participantId: m.participantId, teamId: m.teamId, hostFamilyId: m.hostFamilyId, reason: "L'équipe n'a pas de groupe d'hébergement" });
      } else if (fg !== tg) {
        conflicts.push({ participantId: m.participantId, teamId: m.teamId, hostFamilyId: m.hostFamilyId, reason: "La famille n'est pas dans le groupe d'hébergement de l'équipe" });
      }
    }

    const memberCount = new Map<number, number>();
    for (const m of allMembers) memberCount.set(m.teamId, (memberCount.get(m.teamId) ?? 0) + 1);

    // Hors option « autres équipes » : seules les équipes des groupes du compte (et leurs groupes
    // d'hébergement) sont listées. L'option n'ouvre que les noms et effectifs d'équipes.
    const visibleTeams = showOtherTeams
      ? teams
      : teams.filter((t) => isTeamInScope(t, scope));
    // Les familles (identité, adresse, coordonnées) ne sont JAMAIS renvoyées à un compte limité à des groupes.
    const visibleFamilies = scope.all ? families : [];
    const usedHostingGroups = new Set(visibleTeams.map((t) => t.hostingGroup?.id));
    const visibleHostingGroups = showOtherTeams
      ? hostingGroups
      : hostingGroups.filter((g) => usedHostingGroups.has(g.id));

    return {
      hostingGroups: visibleHostingGroups.map((g) => ({ id: g.id, name: g.name, notes: g.notes, kind: g.kind, color: g.color })),
      teams: visibleTeams.map((t) => ({
        id: t.id,
        name: t.name,
        groupName: t.group?.name ?? null,
        hostingGroupId: t.hostingGroup?.id ?? null,
        memberCount: memberCount.get(t.id) ?? 0,
      })),
      members,
      families: visibleFamilies.map((f) => ({
        id: f.id,
        familyName: f.familyName,
        city: f.city,
        parish: f.parish,
        accommodationType: f.accommodationType,
        latitude: f.latitude,
        longitude: f.longitude,
        maxCapacity: f.maxCapacity,
        maxUnder18: f.maxUnder18,
        maxAnimators: f.maxAnimators,
        status: f.status,
        hostingGroupId: f.hostingGroup?.id ?? null,
        constraints: f.constraints ?? [],
        tags: f.tags ?? [],
      })),
      conflicts,
    };
  }

  // ── Placement ──────────────────────────────────────────────────────────────

  /** Charge l'occupation d'une famille qui chevauche le séjour [arrival, departure]. */
  private async occupantsOf(
    manager: EntityManager,
    familyId: number,
    arrival: string,
    departure: string,
    excludeParticipantId?: number,
  ): Promise<PlacementOccupant[]> {
    const rows = await manager
      .getRepository(ParticipantHostFamilyAssignment)
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.participant', 'p')
      .where('a.host_family_id = :familyId', { familyId })
      .andWhere('a.status != :cancelled', { cancelled: AssignmentStatus.CANCELLED })
      .andWhere('a.arrivalDate <= :departure AND a.departureDate >= :arrival', { arrival, departure })
      .getMany();
    const teamRows = rows.length
      ? await manager
          .getRepository(TeamParticipant)
          .createQueryBuilder('tm')
          .select(['tm.id'])
          .addSelect('tm.team_id', 'team_id')
          .addSelect('tm.participant_id', 'participant_id')
          .where('tm.participant_id IN (:...ids)', { ids: rows.map((r) => r.participant.id) })
          .getRawMany<{ team_id: number; participant_id: number }>()
      : [];
    const teamOf = new Map(teamRows.map((r) => [Number(r.participant_id), Number(r.team_id)]));
    return rows
      .filter((r) => r.participant.id !== excludeParticipantId)
      .map((r) => ({
        teamId: teamOf.get(r.participant.id) ?? null,
        // Adultes = animateurs ET bénévoles rattachés à une équipe (quota adultes, hors mixité jeunes).
        isAnimator: r.participant.type !== PersonType.JEUNE,
        isBenevole: r.participant.type === PersonType.BENEVOLE,
        isUnder18: r.participant.dateOfBirth ? isUnder18At(r.participant.dateOfBirth, arrival) : false,
        sex: r.participant.sex ?? '',
      }));
  }

  private toFamily(family: HostFamily, occupants: PlacementOccupant[]): PlacementFamily {
    return {
      id: family.id,
      maxCapacity: family.maxCapacity,
      maxUnder18: family.maxUnder18,
      maxAnimators: family.maxAnimators,
      occupants,
      needsReview: (family.constraints?.length ?? 0) + (family.tags?.length ?? 0) > 0,
    };
  }

  async place(dto: PlaceParticipantDto, scope: AccessScopeInfo = { all: true }) {
    return this.teams.manager.transaction(async (manager) => {
      const participant = await manager.getRepository(Participant).findOne({
        where: { id: dto.participantId },
        relations: { group: true },
      });
      if (!participant) throw new NotFoundException(`Participant ${dto.participantId} introuvable`);

      // Verrou de ligne : deux placements simultanés dans la même famille sont sérialisés.
      await manager
        .getRepository(HostFamily)
        .createQueryBuilder('f')
        .setLock('pessimistic_write')
        .where('f.id = :id', { id: dto.hostFamilyId })
        .getOne();
      const family = await manager.getRepository(HostFamily).findOne({
        where: { id: dto.hostFamilyId },
        relations: { hostingGroup: true },
      });
      if (!family) throw new NotFoundException(`Famille ${dto.hostFamilyId} introuvable`);
      if (family.status === HostFamilyStatus.INACTIVE) {
        throw new ConflictException('Cette famille est inactive');
      }

      const memberships = await manager.getRepository(TeamParticipant).find({
        where: { participant: { id: participant.id } },
        relations: {
          team: { hostingGroup: true, members: { participant: { group: true } } },
        },
      });
      const team = memberships.find((m) => m.team.hostingGroup)?.team ?? memberships[0]?.team;
      if (!team) throw new ConflictException("Ce participant n'est dans aucune équipe de rassemblement");
      // Compte limité à des groupes : le jeune doit être dans la portée et l'équipe dans
      // la portée dérivée de ses membres (team-scope.ts).
      if (!scope.all) {
        const groupIds = scope.groupIds ?? [];
        if (!groupIds.includes(participant.group?.id ?? -1) || !isTeamInScope(team, scope)) {
          throw new ForbiddenException('Ce participant ou son équipe est hors de votre portée.');
        }
      }
      if (!team.hostingGroup) {
        throw new ConflictException(`L'équipe ${team.name} n'a pas de groupe d'hébergement`);
      }
      if (family.hostingGroup?.id !== team.hostingGroup.id) {
        throw new ConflictException(
          `La famille ${family.familyName} n'est pas dans le groupe d'hébergement de l'équipe ${team.name}`,
        );
      }

      const existing = await manager.getRepository(ParticipantHostFamilyAssignment).find({
        where: { participant: { id: participant.id } },
        relations: { hostFamily: true },
      });
      const current = existing.filter((a) => a.status !== AssignmentStatus.CANCELLED);
      const sameFamily = current.find((a) => a.hostFamily.id === family.id);
      if (sameFamily && !dto.arrivalDate) return { assignment: sameFamily, warnings: [] as string[] };
      const elsewhere = current.filter((a) => a.hostFamily.id !== family.id);
      if (elsewhere.length > 0 && !dto.replaceExisting) {
        throw new ConflictException(
          'Ce participant est déjà placé dans une autre famille : confirmez le déplacement',
        );
      }

      const arrival = dto.arrivalDate ?? current[0]?.arrivalDate ?? dateOnly(participant.group?.arrivalDatetime);
      const departure = dto.departureDate ?? current[0]?.departureDate ?? dateOnly(participant.group?.departureDatetime);
      assertStay(arrival, departure);

      const rules = resolveRules(dto.rules);
      const occupants = await this.occupantsOf(manager, family.id, arrival as string, departure as string, participant.id);
      const refusal = refusalReason(
        this.toFamily(family, occupants),
        {
          isAnimator: participant.type !== PersonType.JEUNE,
          isBenevole: participant.type === PersonType.BENEVOLE,
          isUnder18: participant.dateOfBirth
            ? isUnder18At(participant.dateOfBirth, arrival as string)
            : false,
          sex: participant.sex ?? '',
        },
        rules,
      );
      if (refusal) throw new ConflictException(REASON_MESSAGES[refusal]);

      const warnings: string[] = [];
      if (family.status === HostFamilyStatus.DRAFT) warnings.push("Famille non encore validée");
      if ((family.constraints?.length ?? 0) + (family.tags?.length ?? 0) > 0) {
        warnings.push('Cette famille a des contraintes ou étiquettes à relire');
      }

      const repo = manager.getRepository(ParticipantHostFamilyAssignment);
      const target = sameFamily ?? elsewhere[0];
      let saved: ParticipantHostFamilyAssignment;
      if (target) {
        Object.assign(target, { hostFamily: family, arrivalDate: arrival, departureDate: departure });
        saved = await repo.save(target);
        for (const extra of elsewhere.slice(sameFamily ? 0 : 1)) await repo.remove(extra);
      } else {
        saved = await repo.save(
          repo.create({
            participant,
            hostFamily: family,
            arrivalDate: arrival as string,
            departureDate: departure as string,
            status: AssignmentStatus.PENDING,
            notes: null,
            type: participant.type,
            groupId: participant.group?.id ?? null,
            roomLabel: null,
          }),
        );
      }
      return { assignment: saved, warnings };
    });
  }

  async unplace(
    participantId: number,
    scope: AccessScopeInfo = { all: true },
  ): Promise<{ removed: number }> {
    await this.accessRights.assertParticipantInScope(scope, participantId);
    const rows = await this.assignments.find({
      where: { participant: { id: participantId } },
    });
    const active = rows.filter((a) => a.status !== AssignmentStatus.CANCELLED);
    if (active.length === 0) throw new NotFoundException("Ce participant n'est placé dans aucune famille");
    await this.assignments.remove(active);
    return { removed: active.length };
  }

  /** Aperçu (apply=false) ou enregistrement (apply=true) du placement automatique d'un groupe. */
  async autoPlace(
    hostingGroupId: number,
    dto: AutoPlaceDto,
    scope: AccessScopeInfo = { all: true },
  ): Promise<AutoPlaceResponse> {
    assertStay(dto.arrivalDate, dto.departureDate);
    if (
      dto.apply &&
      (dto.rules?.countAnimatorsInCapacity === undefined || dto.rules?.sexMixing === undefined)
    ) {
      // Règles métier non confirmées : l'enregistrement exige un choix explicite des deux règles.
      throw new BadRequestException(
        'Choisissez explicitement les règles (animateurs dans la capacité, mixité) avant d’appliquer',
      );
    }
    await this.findGroup(hostingGroupId);
    const rules = resolveRules(dto.rules);

    return this.teams.manager.transaction(async (manager) => {
      const teams = await manager.getRepository(Team).find({
        where: { hostingGroup: { id: hostingGroupId } },
        relations: { members: { participant: { group: true } } },
      });
      const selectedTeams = teams.filter((t) => !dto.teamIds || dto.teamIds.includes(t.id));
      const teamIds = selectedTeams.map((t) => t.id);
      if (teamIds.length === 0) return { applied: false, proposals: [], unplaced: [] };
      // Compte limité à des groupes : toutes les équipes visées doivent être dans la portée
      // dérivée de leurs membres, ou vides (restreindre avec teamIds sinon).
      // Les jeunes sont contrôlés plus bas.
      if (!scope.all) {
        if (selectedTeams.some((t) => !isTeamWritableInScope(t, scope))) {
          throw new ForbiddenException('Une équipe de ce groupe est hors de votre portée.');
        }
      }

      const familiesQb = manager
        .getRepository(HostFamily)
        .createQueryBuilder('f')
        .where('f.hosting_group_id = :hostingGroupId', { hostingGroupId })
        .andWhere('f.status = :validated', { validated: HostFamilyStatus.VALIDATED })
        .orderBy('f.id', 'ASC');
      if (dto.apply) familiesQb.setLock('pessimistic_write');
      const families = await familiesQb.getMany();

      const memberships = await manager.getRepository(TeamParticipant).find({
        where: { team: { id: In(teamIds) } },
        relations: { team: true, participant: { group: true } },
      });
      const wanted = new Set(teamIds);
      const placedRows = await manager
        .getRepository(ParticipantHostFamilyAssignment)
        .createQueryBuilder('a')
        .select('a.participant_id', 'pid')
        .where('a.status != :cancelled', { cancelled: AssignmentStatus.CANCELLED })
        .getRawMany<{ pid: number }>();
      const placedIds = new Set(placedRows.map((r) => Number(r.pid)));
      const seen = new Set<number>();
      const people: PlacementPerson[] = [];
      const participants = new Map<number, Participant>();
      for (const m of memberships) {
        if (!wanted.has(m.team.id) || placedIds.has(m.participant.id) || seen.has(m.participant.id)) continue;
        seen.add(m.participant.id);
        participants.set(m.participant.id, m.participant);
        people.push({
          id: m.participant.id,
          teamId: m.team.id,
          isAnimator: m.participant.type !== PersonType.JEUNE,
          isBenevole: m.participant.type === PersonType.BENEVOLE,
          isUnder18: m.participant.dateOfBirth
            ? isUnder18At(m.participant.dateOfBirth, dto.arrivalDate)
            : false,
          sex: m.participant.sex ?? '',
        });
      }

      if (!scope.all) {
        const groupIds = scope.groupIds ?? [];
        for (const person of participants.values()) {
          if (!groupIds.includes(person.group?.id ?? -1)) {
            throw new ForbiddenException('Un participant est hors de votre portée.');
          }
        }
      }

      const planFamilies: PlacementFamily[] = [];
      for (const family of families) {
        planFamilies.push(
          this.toFamily(
            family,
            await this.occupantsOf(manager, family.id, dto.arrivalDate, dto.departureDate),
          ),
        );
      }

      const result = proposePlacement(people, planFamilies, rules);

      if (dto.apply && result.proposals.length > 0) {
        const repo = manager.getRepository(ParticipantHostFamilyAssignment);
        const familyById = new Map(families.map((f) => [f.id, f]));
        await repo.save(
          result.proposals.map((p) => {
            const participant = participants.get(p.participantId) as Participant;
            return repo.create({
              participant,
              hostFamily: familyById.get(p.hostFamilyId) as HostFamily,
              arrivalDate: dto.arrivalDate,
              departureDate: dto.departureDate,
              status: AssignmentStatus.PENDING,
              notes: 'Placement automatique à confirmer',
              type: participant.type,
              groupId: participant.group?.id ?? null,
              roomLabel: null,
            });
          }),
        );
      }
      return { applied: Boolean(dto.apply), ...result };
    });
  }
}
