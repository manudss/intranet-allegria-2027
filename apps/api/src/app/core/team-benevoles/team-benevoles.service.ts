import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AssignmentStatus,
  Group,
  HostingGroup,
  Participant,
  ParticipantRegistrationStatus,
  PersonSource,
  PersonType,
  Team,
  TeamParticipant,
  TeamParticipantRole,
  Volunteer,
  VolunteerSkillType,
  VolunteerTag,
  VolunteerTeam,
  VolunteerTeamLodging,
  VolunteerTeamMembership,
} from '../entities';
import {
  ApplyRepartitionDto,
  ApplyRepartitionResult,
  AssignBenevoleDto,
  BenevoleAssignment,
  RepartitionFilters,
  RepartitionTeamRow,
  RepartitionTeamsQueryDto,
  RepartitionVolunteerRow,
  RepartitionVolunteersQueryDto,
  RepartitionVolunteersResult,
} from './team-benevoles.types';

/**
 * Affectation d'un bénévole à une équipe de rassemblement EN TANT QU'ADULTE :
 * une fiche participant de type BENEVOLE (projection du bénévole, sans date de
 * naissance ni sexe) devient membre de l'équipe. Elle compte dans la capacité
 * totale des hébergements et dans le quota d'adultes, jamais dans le quota
 * de mineurs. Le logement du bénévole (volunteer_team_lodgings, affiché dans
 * l'application mobile) est synchronisé dans la même transaction.
 */
@Injectable()
export class TeamBenevolesService {
  constructor(
    @InjectRepository(Team)
    private readonly teamsRepository: Repository<Team>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepository: Repository<Volunteer>,
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    @InjectRepository(TeamParticipant)
    private readonly teamParticipantsRepository: Repository<TeamParticipant>,
    @InjectRepository(VolunteerTeamLodging)
    private readonly lodgingsRepository: Repository<VolunteerTeamLodging>,
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
    @InjectRepository(HostingGroup)
    private readonly hostingGroupsRepository: Repository<HostingGroup>,
    @InjectRepository(VolunteerTeam)
    private readonly polesRepository: Repository<VolunteerTeam>,
    @InjectRepository(VolunteerTeamMembership)
    private readonly poleMembershipsRepository: Repository<VolunteerTeamMembership>,
    @InjectRepository(VolunteerTag)
    private readonly tagsRepository: Repository<VolunteerTag>,
  ) {}

  /** Toutes les affectations bénévoles (pour le board de placement). */
  async listAssignments(): Promise<BenevoleAssignment[]> {
    const fiches = await this.participantsRepository.find({
      where: { type: PersonType.BENEVOLE },
      relations: { volunteer: true, teamMemberships: { team: true } },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    return fiches.filter((f) => f.volunteer).map((f) => this.toAssignment(f));
  }

  /** Bénévoles affectés à une équipe (tiroir de détail de l'équipe). */
  async listForTeam(teamId: number): Promise<BenevoleAssignment[]> {
    const team = await this.teamsRepository.findOneBy({ id: teamId });
    if (!team) throw new NotFoundException(`Equipe ${teamId} introuvable`);
    const fiches = await this.participantsRepository.find({
      where: { type: PersonType.BENEVOLE, teamMemberships: { team: { id: teamId } } },
      relations: { volunteer: true, teamMemberships: { team: true } },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    return fiches.filter((f) => f.volunteer).map((f) => this.toAssignment(f));
  }

  async assign(teamId: number, dto: AssignBenevoleDto): Promise<BenevoleAssignment> {
    if (!dto.volunteerId) throw new BadRequestException('Bénévole requis');
    return this.teamsRepository.manager.transaction(async (manager) => {
      const teams = manager.getRepository(Team);
      const participants = manager.getRepository(Participant);
      const memberships = manager.getRepository(TeamParticipant);
      const lodgings = manager.getRepository(VolunteerTeamLodging);

      const team = await teams.findOneBy({ id: teamId });
      if (!team) throw new NotFoundException(`Equipe ${teamId} introuvable`);
      const volunteer = await this.volunteersRepository.findOneBy({ id: dto.volunteerId });
      if (!volunteer) throw new NotFoundException(`Bénévole ${dto.volunteerId} introuvable`);

      let fiche = await participants.findOne({
        where: { type: PersonType.BENEVOLE, volunteer: { id: volunteer.id } },
        relations: { teamMemberships: { team: true } },
      });
      const current = fiche?.teamMemberships?.[0];
      if (current) {
        if (current.team.id === teamId) {
          throw new ConflictException('Ce bénévole est déjà dans cette équipe');
        }
        throw new ConflictException(
          `Ce bénévole est déjà affecté à l'équipe ${current.team.name} : retirez-le d'abord`,
        );
      }

      const currentSize = await memberships.count({ where: { team: { id: teamId } } });
      if (currentSize >= team.maxSize) {
        throw new BadRequestException(`Equipe complete: taille max ${team.maxSize}`);
      }

      if (!fiche) {
        fiche = await participants.save(
          participants.create({
            firstName: volunteer.firstName,
            lastName: volunteer.lastName,
            type: PersonType.BENEVOLE,
            dateOfBirth: null,
            sex: null,
            mejAgeGroup: null,
            volunteer,
            group: null,
            status: ParticipantRegistrationStatus.CONFIRMED,
            source: PersonSource.STAFF,
            emergencyContactName: null,
            emergencyContactPhone: null,
            diocese: null,
            city: null,
          }),
        );
      }

      await memberships.save(
        memberships.create({
          team,
          participant: fiche,
          role: TeamParticipantRole.MEMBER,
          notes: dto.notes ?? null,
        }),
      );

      // Synchronise le logement affiché dans l'application mobile (Mon hébergement).
      const lodging = await lodgings.findOne({ where: { volunteerId: volunteer.id } });
      if (lodging) {
        if (lodging.teamId !== teamId) {
          lodging.teamId = teamId;
          await lodgings.save(lodging);
        }
      } else {
        await lodgings.save(
          lodgings.create({ volunteerId: volunteer.id, teamId, room: null, notes: null, startAt: null, endAt: null }),
        );
      }

      return {
        volunteerId: volunteer.id,
        participantId: fiche.id,
        teamId,
        teamName: team.name,
        firstName: volunteer.firstName,
        lastName: volunteer.lastName,
        mission: volunteer.team ?? null,
      };
    });
  }

  async unassign(teamId: number, volunteerId: number): Promise<void> {
    await this.teamsRepository.manager.transaction(async (manager) => {
      const participants = manager.getRepository(Participant);
      const memberships = manager.getRepository(TeamParticipant);
      const lodgings = manager.getRepository(VolunteerTeamLodging);

      const fiche = await participants.findOne({
        where: { type: PersonType.BENEVOLE, volunteer: { id: volunteerId } },
        relations: { teamMemberships: { team: true }, hostFamilyAssignments: true },
      });
      const membership = fiche?.teamMemberships?.find((m) => m.team.id === teamId);
      if (!fiche || !membership) {
        throw new NotFoundException(
          `Affectation team=${teamId} benevole=${volunteerId} introuvable`,
        );
      }
      const placed = (fiche.hostFamilyAssignments ?? []).some(
        (a) => a.status !== AssignmentStatus.CANCELLED,
      );
      if (placed) {
        throw new ConflictException(
          "Ce bénévole est placé dans une famille d'accueil : retirez d'abord son affectation (étape 2 du placement)",
        );
      }
      await memberships.remove(membership);
      // La fiche BENEVOLE n'est qu'une projection du bénévole : elle disparaît avec l'affectation.
      await participants.remove(fiche);
      const lodging = await lodgings.findOne({ where: { volunteerId } });
      if (lodging && lodging.teamId === teamId) {
        await lodgings.remove(lodging);
      }
    });
  }

  // ── Page de répartition (benevoles/repartition) ─────────────────────────

  /** Listes de valeurs pour les filtres des étapes 1 et 2. */
  async repartitionFilters(): Promise<RepartitionFilters> {
    const [hostingGroups, groups, poles, tags] = await Promise.all([
      this.hostingGroupsRepository.find({ order: { name: 'ASC' } }),
      this.groupsRepository.find({ order: { name: 'ASC' } }),
      this.polesRepository.find({ where: { isActive: true }, order: { name: 'ASC' } }),
      this.tagsRepository
        .createQueryBuilder('tag')
        .select('DISTINCT tag.value', 'value')
        .orderBy('value', 'ASC')
        .getRawMany<{ value: string }>(),
    ]);
    return {
      hostingGroups: hostingGroups.map((g) => ({ id: g.id, name: g.name })),
      groups: groups.map((g) => ({ id: g.id, name: g.name })),
      poles: poles.map((p) => ({ id: p.id, name: p.name })),
      tags: tags.map((t) => t.value),
      skills: Object.values(VolunteerSkillType),
    };
  }

  /** Étape 1 : équipes de rassemblement avec remplissage (jeunes / adultes / max). */
  async searchRepartitionTeams(query: RepartitionTeamsQueryDto): Promise<RepartitionTeamRow[]> {
    const teams = await this.teamsRepository.find({
      relations: { group: true, hostingGroup: true, members: { participant: true } },
      order: { name: 'ASC' },
    });
    const q = (query.search ?? '').trim().toLowerCase();
    return teams
      .map((team) => {
        const members = team.members ?? [];
        const jeunes = members.filter((m) => m.participant?.type === PersonType.JEUNE).length;
        const adultes = members.length - jeunes;
        const free = Math.max(0, team.maxSize - members.length);
        return {
          id: team.id,
          name: team.name,
          groupId: team.group?.id ?? null,
          groupName: team.group?.name ?? null,
          hostingGroupId: team.hostingGroup?.id ?? null,
          hostingGroupName: team.hostingGroup?.name ?? null,
          jeunes,
          adultes,
          maxSize: team.maxSize,
          free,
        };
      })
      .filter(
        (row) =>
          (!q || row.name.toLowerCase().includes(q)) &&
          (!query.hostingGroupId || row.hostingGroupId === Number(query.hostingGroupId)) &&
          (!query.groupId || row.groupId === Number(query.groupId)) &&
          (query.fill !== 'free' || row.free > 0) &&
          (query.fill !== 'full' || row.free === 0),
      );
  }

  /** Étape 2 : bénévoles filtrés (recherche, pôle, compétence, étiquette, affectation). */
  async searchRepartitionVolunteers(
    query: RepartitionVolunteersQueryDto,
  ): Promise<RepartitionVolunteersResult> {
    const [volunteers, fiches] = await Promise.all([
      this.volunteersRepository.find({
        relations: { skills: true, tags: true, teamMemberships: { volunteerTeam: true } },
        order: { lastName: 'ASC', firstName: 'ASC' },
      }),
      this.participantsRepository.find({
        where: { type: PersonType.BENEVOLE },
        relations: { volunteer: true, teamMemberships: { team: true } },
      }),
    ]);
    const teamByVolunteer = new Map<number, { id: number; name: string }>();
    for (const fiche of fiches) {
      const team = fiche.teamMemberships?.[0]?.team;
      if (fiche.volunteer && team) {
        teamByVolunteer.set(fiche.volunteer.id, { id: team.id, name: team.name });
      }
    }
    const tokens = (query.search ?? '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const rows: RepartitionVolunteerRow[] = volunteers.map((v) => {
      const current = teamByVolunteer.get(v.id) ?? null;
      return {
        id: v.id,
        firstName: v.firstName,
        lastName: v.lastName,
        mission: v.team ?? null,
        poles: (v.teamMemberships ?? [])
          .map((m) => m.volunteerTeam?.name)
          .filter((n): n is string => !!n),
        skills: (v.skills ?? []).map((s) => s.skill),
        tags: (v.tags ?? []).map((t) => t.value),
        teamId: current?.id ?? null,
        teamName: current?.name ?? null,
      };
    });
    const filtered = rows.filter((row) => {
      const haystack = `${row.firstName} ${row.lastName}`.toLowerCase();
      return (
        tokens.every((t) => haystack.includes(t)) &&
        (!query.skill || row.skills.includes(query.skill)) &&
        (!query.tag || row.tags.includes(query.tag)) &&
        (!query.poleId ||
          volunteers
            .find((v) => v.id === row.id)
            ?.teamMemberships?.some((m) => m.volunteerTeam?.id === Number(query.poleId))) &&
        (query.assignment !== 'unassigned' || row.teamId === null) &&
        (query.assignment !== 'assigned' || row.teamId !== null)
      );
    });
    // Pagination explicite, sans plafond silencieux : le total est toujours
    // retourné ; l'UI affiche « X sur Y », « Charger plus » pagine et
    // « Tout ajouter » récupère toutes les correspondances.
    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 1000);
    const offset = Math.max(Number(query.offset) || 0, 0);
    return { total: filtered.length, volunteers: filtered.slice(offset, offset + limit) };
  }

  /**
   * Étape 3 : application groupée des affectations corrigées à la main ou
   * proposées automatiquement. Une seule transaction : tout ou rien.
   * teamId null = retirer le bénévole de son équipe (mêmes règles que
   * l'unassign unitaire : refusé s'il est placé dans une famille d'accueil).
   */
  async applyRepartition(dto: ApplyRepartitionDto): Promise<ApplyRepartitionResult> {
    const entries = dto.assignments ?? [];
    if (entries.length === 0) return { applied: 0 };
    return this.teamsRepository.manager.transaction(async (manager) => {
      const teams = manager.getRepository(Team);
      const participants = manager.getRepository(Participant);
      const memberships = manager.getRepository(TeamParticipant);
      const lodgings = manager.getRepository(VolunteerTeamLodging);

      // Charge les fiches et l'état actuel de chaque bénévole concerné.
      const planned = new Map<number, { fiche: Participant | null; from: number | null; to: number | null }>();
      for (const entry of entries) {
        const volunteer = await this.volunteersRepository.findOneBy({ id: entry.volunteerId });
        if (!volunteer) throw new NotFoundException(`Bénévole ${entry.volunteerId} introuvable`);
        const fiche = await participants.findOne({
          where: { type: PersonType.BENEVOLE, volunteer: { id: entry.volunteerId } },
          relations: { teamMemberships: { team: true }, hostFamilyAssignments: true },
        });
        const from = fiche?.teamMemberships?.[0]?.team?.id ?? null;
        planned.set(entry.volunteerId, { fiche, from, to: entry.teamId ?? null });
      }

      // Vérifie les équipes cibles et la capacité finale de chacune.
      const targetIds = [...new Set([...planned.values()].map((p) => p.to).filter((x): x is number => x !== null))];
      const targetTeams = new Map<number, Team>();
      for (const id of targetIds) {
        const team = await teams.findOne({ where: { id }, relations: { members: true } });
        if (!team) throw new NotFoundException(`Equipe ${id} introuvable`);
        targetTeams.set(id, team);
      }
      for (const [id, team] of targetTeams) {
        const currentSize = await memberships.count({ where: { team: { id } } });
        const joining = [...planned.values()].filter((p) => p.to === id && p.from !== id).length;
        const leaving = [...planned.values()].filter((p) => p.from === id && p.to !== id).length;
        if (currentSize - leaving + joining > team.maxSize) {
          throw new BadRequestException(
            `Equipe ${team.name} complete: taille max ${team.maxSize}`,
          );
        }
      }

      let applied = 0;
      for (const [volunteerId, plan] of planned) {
        if (plan.from === plan.to) continue;
        let fiche = plan.fiche;
        const volunteer = (await this.volunteersRepository.findOneBy({ id: volunteerId }))!;

        // Retrait de l'équipe actuelle (refusé si placé en famille d'accueil).
        if (plan.from !== null && fiche) {
          const placed = (fiche.hostFamilyAssignments ?? []).some(
            (a) => a.status !== AssignmentStatus.CANCELLED,
          );
          if (placed) {
            throw new ConflictException(
              `${volunteer.firstName} ${volunteer.lastName} est placé dans une famille d'accueil : retirez d'abord son affectation (étape 2 du placement)`,
            );
          }
          const membership = fiche.teamMemberships.find((m) => m.team.id === plan.from);
          if (membership) await memberships.remove(membership);
          const lodging = await lodgings.findOne({ where: { volunteerId } });
          if (lodging && lodging.teamId === plan.from) {
            if (plan.to === null) await lodgings.remove(lodging);
          }
        }

        // Affectation à la nouvelle équipe (crée la fiche BENEVOLE si besoin).
        if (plan.to !== null) {
          const team = targetTeams.get(plan.to)!;
          if (!fiche) {
            fiche = await participants.save(
              participants.create({
                firstName: volunteer.firstName,
                lastName: volunteer.lastName,
                type: PersonType.BENEVOLE,
                dateOfBirth: null,
                sex: null,
                mejAgeGroup: null,
                volunteer,
                group: null,
                status: ParticipantRegistrationStatus.CONFIRMED,
                source: PersonSource.STAFF,
                emergencyContactName: null,
                emergencyContactPhone: null,
                diocese: null,
                city: null,
              }),
            );
          }
          await memberships.save(
            memberships.create({ team, participant: fiche, role: TeamParticipantRole.MEMBER }),
          );
          const lodging = await lodgings.findOne({ where: { volunteerId } });
          if (lodging) {
            if (lodging.teamId !== plan.to) {
              lodging.teamId = plan.to;
              await lodgings.save(lodging);
            }
          } else {
            await lodgings.save(
              lodgings.create({ volunteerId, teamId: plan.to, room: null, notes: null, startAt: null, endAt: null }),
            );
          }
        } else if (fiche) {
          // Plus d'équipe : la fiche projection disparaît (cf. unassign).
          await participants.remove(fiche);
        }
        applied += 1;
      }
      return { applied };
    });
  }

  private toAssignment(fiche: Participant): BenevoleAssignment {
    const membership = fiche.teamMemberships?.[0];
    return {
      volunteerId: fiche.volunteer!.id,
      participantId: fiche.id,
      teamId: membership?.team.id ?? 0,
      teamName: membership?.team.name ?? '',
      firstName: fiche.volunteer!.firstName,
      lastName: fiche.volunteer!.lastName,
      mission: fiche.volunteer!.team ?? null,
    };
  }
}
