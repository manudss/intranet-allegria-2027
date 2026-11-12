import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Group,
  MejAgeGroup,
  Participant,
  PersonType,
  ParticipantRegistrationStatus,
  Team,
  TeamParticipant,
  TeamParticipantRole,
} from '../entities';
import {
  AlgoParticipant,
  AlgoParams,
  AlgoTeam,
  proposeJeunesAssignment,
} from './jeunes-repartition.algorithm';
import {
  ApplyJeunesRepartitionDto,
  ApplyJeunesRepartitionResult,
  BulkCreateTeamsDto,
  BulkCreateTeamsResult,
  JeunesRepartitionFilters,
  ProposeRepartitionDto,
  ProposeRepartitionResult,
  RepartitionJeunesTeamsQueryDto,
  RepartitionParticipantRow,
  RepartitionParticipantsQueryDto,
  RepartitionParticipantsResult,
  RepartitionParamsDto,
} from './jeunes-repartition.types';

const DEFAULT_JEUNES_PER_TEAM = 6;
const DEFAULT_ADULTS_PER_TEAM = 1;
const DEFAULT_GEO_MAX_PER_TEAM = 1;

export interface RepartitionTeamRow {
  id: number;
  name: string;
  maxSize: number;
  groupId: number | null;
  groupName: string | null;
  jeunesCount: number;
  adultesCount: number;
  totalCount: number;
}

@Injectable()
export class JeunesRepartitionService {
  constructor(
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    @InjectRepository(Team)
    private readonly teamsRepository: Repository<Team>,
    @InjectRepository(TeamParticipant)
    private readonly teamParticipantsRepository: Repository<TeamParticipant>,
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
  ) {}

  // ── Étape 1 : participants ────────────────────────────────────────────────

  async repartitionFilters(): Promise<JeunesRepartitionFilters> {
    const participants = await this.participantsRepository.find({
      where: [
        { type: PersonType.JEUNE, status: ParticipantRegistrationStatus.CONFIRMED },
        { type: PersonType.ANIMATEUR, status: ParticipantRegistrationStatus.CONFIRMED },
      ],
      relations: { group: true },
    });

    const groups = new Map<number, string>();
    const cities = new Set<string>();
    const dioceses = new Set<string>();
    const ageGroups = new Set<MejAgeGroup>();

    for (const p of participants) {
      if (p.group) groups.set(p.group.id, p.group.name);
      if (p.city) cities.add(p.city);
      const diocese = p.diocese ?? p.group?.diocese;
      if (diocese) dioceses.add(diocese);
      if (p.mejAgeGroup) ageGroups.add(p.mejAgeGroup);
    }

    return {
      groups: [...groups.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      cities: [...cities].sort((a, b) => a.localeCompare(b, 'fr')),
      dioceses: [...dioceses].sort((a, b) => a.localeCompare(b, 'fr')),
      ageGroups: [...ageGroups].sort(),
    };
  }

  async searchParticipants(query: RepartitionParticipantsQueryDto): Promise<RepartitionParticipantsResult> {
    const participants = await this.participantsRepository.find({
      where: [
        { type: PersonType.JEUNE, status: ParticipantRegistrationStatus.CONFIRMED },
        { type: PersonType.ANIMATEUR, status: ParticipantRegistrationStatus.CONFIRMED },
      ],
      relations: { group: true, teamMemberships: { team: true } },
    });

    const search = query.search?.trim().toLowerCase();
    const assignment = query.assignment ?? 'all';

    const rows = participants
      .filter((p) => {
        if (query.type && query.type !== 'all' && p.type !== query.type) return false;
        if (query.ageGroup && p.mejAgeGroup !== query.ageGroup) return false;
        if (query.sex && p.sex !== query.sex) return false;
        if (query.groupId && p.group?.id !== Number(query.groupId)) return false;
        if (query.city && (p.city ?? '').toLowerCase() !== query.city.toLowerCase()) return false;
        if (query.diocese) {
          const diocese = p.diocese ?? p.group?.diocese ?? '';
          if (diocese.toLowerCase() !== query.diocese.toLowerCase()) return false;
        }
        const membership = p.teamMemberships?.[0] ?? null;
        if (assignment === 'unassigned' && membership) return false;
        if (assignment === 'assigned' && !membership) return false;
        if (search) {
          const haystack =
            p.type === PersonType.ANIMATEUR
              ? `${p.firstName} ${p.lastName}`.toLowerCase()
              : p.firstName.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .map((p): RepartitionParticipantRow => {
        const membership = p.teamMemberships?.[0] ?? null;
        const isJeune = p.type === PersonType.JEUNE;
        return {
          id: p.id,
          type: p.type === PersonType.ANIMATEUR ? 'ANIMATEUR' : 'JEUNE',
          firstName: p.firstName,
          // Confidentialité mineurs : jamais le nom d'un jeune.
          lastName: isJeune ? null : p.lastName,
          age: computeAge(p.dateOfBirth),
          sex: p.sex ?? null,
          mejAgeGroup: p.mejAgeGroup ?? null,
          groupId: p.group?.id ?? null,
          groupName: p.group?.name ?? null,
          city: p.city ?? null,
          diocese: p.diocese ?? p.group?.diocese ?? null,
          teamId: membership?.team?.id ?? null,
          teamName: membership?.team?.name ?? null,
        };
      })
      .sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr') || a.id - b.id);

    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 1000);
    const offset = Math.max(Number(query.offset) || 0, 0);
    return { total: rows.length, participants: rows.slice(offset, offset + limit) };
  }

  // ── Étape 2 : équipes ──────────────────────────────────────────────────────

  async searchTeams(query: RepartitionJeunesTeamsQueryDto): Promise<RepartitionTeamRow[]> {
    const teams = await this.teamsRepository.find({
      relations: { group: true, members: { participant: true } },
      order: { name: 'ASC' },
    });

    const search = query.search?.trim().toLowerCase();
    const rows = teams.map((team): RepartitionTeamRow => {
      const members = team.members ?? [];
      const jeunes = members.filter((m) => m.participant?.type !== PersonType.ANIMATEUR).length;
      const adultes = members.length - jeunes;
      return {
        id: team.id,
        name: team.name,
        maxSize: team.maxSize,
        groupId: team.group?.id ?? null,
        groupName: team.group?.name ?? null,
        jeunesCount: jeunes,
        adultesCount: adultes,
        totalCount: members.length,
      };
    });

    return rows.filter((row) => {
      if (search && !row.name.toLowerCase().includes(search)) return false;
      if (query.groupId && row.groupId !== Number(query.groupId)) return false;
      if (query.fill === 'free' && row.totalCount >= row.maxSize) return false;
      if (query.fill === 'full' && row.totalCount < row.maxSize) return false;
      return true;
    });
  }

  async bulkCreateTeams(dto: BulkCreateTeamsDto): Promise<BulkCreateTeamsResult> {
    const count = Math.floor(Number(dto.count));
    if (!Number.isFinite(count) || count < 1 || count > 100) {
      throw new BadRequestException('Le nombre d equipes doit etre compris entre 1 et 100.');
    }
    const baseName = (dto.baseName ?? 'Équipe').trim() || 'Équipe';
    const maxSize = Math.max(1, Math.floor(Number(dto.maxSize) || 12));

    const existing = await this.teamsRepository.find();
    let nextIndex = 1;
    for (const team of existing) {
      const match = new RegExp(`^${escapeRegExp(baseName)}\\s+(\\d+)$`).exec(team.name.trim());
      if (match) nextIndex = Math.max(nextIndex, Number(match[1]) + 1);
    }

    const created: { id: number; name: string; maxSize: number }[] = [];
    for (let i = 0; i < count; i += 1) {
      const team = await this.teamsRepository.save(
        this.teamsRepository.create({ name: `${baseName} ${nextIndex + i}`, maxSize }),
      );
      created.push({ id: team.id, name: team.name, maxSize: team.maxSize });
    }
    return { created };
  }

  // ── Étape 3 : proposition automatique ─────────────────────────────────────

  async propose(dto: ProposeRepartitionDto): Promise<ProposeRepartitionResult> {
    if (!dto.participantIds?.length) throw new BadRequestException('Aucun participant selectionne.');
    if (!dto.teamIds?.length) throw new BadRequestException('Aucune equipe selectionnee.');

    const params = normalizeParams(dto.params);
    const granularity = dto.params?.geoGranularity ?? 'group';
    const moveAssigned = dto.params?.moveAssigned ?? false;

    const participants = await this.participantsRepository.find({
      where: { id: In(dto.participantIds) },
      relations: { group: true, teamMemberships: { team: true } },
    });
    const teams = await this.teamsRepository.find({
      where: { id: In(dto.teamIds) },
      relations: { group: true, members: { participant: { group: true } } },
    });
    const selectedTeamIds = new Set(teams.map((t) => t.id));

    const pool: AlgoParticipant[] = [];
    const preMembers = new Map<number, AlgoParticipant[]>();

    for (const p of participants) {
      const currentTeamId = p.teamMemberships?.[0]?.team?.id ?? null;
      const alreadyAssigned = currentTeamId !== null;
      if (alreadyAssigned && !moveAssigned) {
        // Non déplacé : il reste en place et compte dans la capacité de son équipe.
        if (selectedTeamIds.has(currentTeamId as number)) {
          const list = preMembers.get(currentTeamId as number) ?? [];
          list.push(toAlgoParticipant(p, granularity));
          preMembers.set(currentTeamId as number, list);
        }
        continue;
      }
      pool.push(toAlgoParticipant(p, granularity));
    }

    const algoTeams: AlgoTeam[] = teams.map((team) => {
      const members: AlgoParticipant[] = (team.members ?? [])
        .filter((m) => m.participant)
        // Les participants du pool déplaçables ne comptent pas comme membres en place.
        .filter((m) => !pool.some((p) => p.id === m.participant.id))
        .map((m) => toAlgoParticipant(m.participant, granularity));
      for (const extra of preMembers.get(team.id) ?? []) {
        if (!members.some((m) => m.id === extra.id)) members.push(extra);
      }
      return { id: team.id, name: team.name, maxSize: team.maxSize, members };
    });

    const result = proposeJeunesAssignment(pool, algoTeams, params);

    return {
      proposals: [...result.proposals.entries()].map(([participantId, teamId]) => ({
        participantId,
        teamId,
      })),
      unplaced: result.unplaced,
      violations: result.violations,
      teamStats: result.stats,
    };
  }

  // ── Étape 3 : application ──────────────────────────────────────────────────

  async apply(dto: ApplyJeunesRepartitionDto): Promise<ApplyJeunesRepartitionResult> {
    if (!dto.assignments?.length) return { applied: 0 };

    const participantIds = [...new Set(dto.assignments.map((a) => a.participantId))];
    const teamIds = [...new Set(dto.assignments.map((a) => a.teamId).filter((id): id is number => id !== null))];

    return this.participantsRepository.manager.transaction(async (manager) => {
      const participants = await manager.find(Participant, {
        where: { id: In(participantIds) },
        relations: { teamMemberships: { team: true } },
      });
      if (participants.length !== participantIds.length) {
        throw new BadRequestException('Certains participants selectionnes sont introuvables.');
      }
      const teams = teamIds.length ? await manager.find(Team, { where: { id: In(teamIds) } }) : [];
      if (teams.length !== teamIds.length) {
        throw new BadRequestException('Certaines equipes selectionnees sont introuvables.');
      }

      const byId = new Map(participants.map((p) => [p.id, p]));
      const teamById = new Map(teams.map((t) => [t.id, t]));
      let applied = 0;

      for (const entry of dto.assignments) {
        const participant = byId.get(entry.participantId);
        if (!participant) continue;
        const existing = participant.teamMemberships?.[0] ?? null;

        if (entry.teamId === null) {
          if (existing) {
            await manager.delete(TeamParticipant, { id: existing.id });
            applied += 1;
          }
          continue;
        }

        const team = teamById.get(entry.teamId);
        if (!team) continue;
        if (existing && existing.team?.id === team.id) continue;

        if (existing) {
          await manager.delete(TeamParticipant, { id: existing.id });
        }

        const isAnimator = participant.type === PersonType.ANIMATEUR;
        const role = isAnimator
          ? await this.animatorRole(manager, team.id)
          : TeamParticipantRole.MEMBER;

        await manager.save(
          TeamParticipant,
          manager.create(TeamParticipant, {
            team: { id: team.id } as Team,
            participant: { id: participant.id } as Participant,
            role,
          }),
        );
        applied += 1;
      }

      return { applied };
    });
  }

  /** Premier animateur d'une équipe = MEMBER (référent), les suivants ASSISTANT. */
  private async animatorRole(manager: Repository<Participant>['manager'], teamId: number) {
    const count = await manager.count(TeamParticipant, {
      where: { team: { id: teamId }, participant: { type: PersonType.ANIMATEUR } },
    });
    return count === 0 ? TeamParticipantRole.MEMBER : TeamParticipantRole.ASSISTANT;
  }
}

function normalizeParams(params?: RepartitionParamsDto): AlgoParams {
  return {
    jeunesPerTeam: positiveInt(params?.jeunesPerTeam, DEFAULT_JEUNES_PER_TEAM),
    adultsPerTeam: positiveInt(params?.adultsPerTeam, DEFAULT_ADULTS_PER_TEAM),
    ageMode: params?.ageMode ?? 'mixed',
    sexMode: params?.sexMode ?? 'balanced',
    geoMaxPerTeam: positiveInt(params?.geoMaxPerTeam, DEFAULT_GEO_MAX_PER_TEAM),
    separateAnimators: params?.separateAnimators ?? true,
  };
}

function positiveInt(value: unknown, fallback: number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function computeAge(dateOfBirth: string | Date | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function toAlgoParticipant(
  p: Participant,
  granularity: 'group' | 'city' | 'diocese',
): AlgoParticipant {
  const age = computeAge(p.dateOfBirth);
  let originKey: string;
  let originLabel: string;
  if (granularity === 'city') {
    originLabel = p.city ?? p.group?.name ?? 'Origine inconnue';
    originKey = `city:${originLabel.toLowerCase()}`;
  } else if (granularity === 'diocese') {
    originLabel = p.diocese ?? p.group?.diocese ?? 'Diocèse inconnu';
    originKey = `diocese:${originLabel.toLowerCase()}`;
  } else {
    originLabel = p.group?.name ?? 'Sans groupe';
    originKey = `group:${p.group?.id ?? 'none'}`;
  }
  return {
    id: p.id,
    kind: p.type === PersonType.ANIMATEUR ? 'ANIMATEUR' : 'JEUNE',
    age,
    tranche: p.mejAgeGroup ?? ageBand(age),
    sex: p.sex ?? null,
    originKey,
    originLabel,
  };
}

function ageBand(age: number | null): string {
  if (age === null) return 'inconnu';
  if (age < 15) return '12-14';
  if (age < 17) return '15-16';
  return '17+';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
