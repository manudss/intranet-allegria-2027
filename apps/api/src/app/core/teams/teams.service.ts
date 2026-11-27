import { Injectable, NotFoundException } from '@nestjs/common';
import type { AccessScopeInfo } from '../auth/access-module.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Group, Participant, Team, TeamParticipant, Volunteer } from '../entities';
import { CreateTeamDto, UpdateTeamDto } from './teams.types';
import { isTeamInScope } from './team-scope';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamsRepository: Repository<Team>,
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepository: Repository<Volunteer>,
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    @InjectRepository(TeamParticipant)
    private readonly teamParticipantsRepository: Repository<TeamParticipant>,
  ) {}

  async create(dto: CreateTeamDto, scope: AccessScopeInfo = { all: true }): Promise<Team> {
    // Le lien équipe→délégation n'est plus exigé ni utilisé pour l'accès : la délégation
    // d'une équipe se déduit de ses membres (team-scope.ts). groupId reste accepté et
    // stocké pendant la transition, sans contrôle de périmètre.
    const team = this.teamsRepository.create({
      name: dto.name,
      group: dto.groupId ? await this.groupsRepository.findOneBy({ id: dto.groupId }) : null,
      primaryAnimator: dto.primaryAnimatorId
        ? await this.volunteersRepository.findOneBy({ id: dto.primaryAnimatorId })
        : null,
      secondaryAnimator: dto.secondaryAnimatorId
        ? await this.volunteersRepository.findOneBy({ id: dto.secondaryAnimatorId })
        : null,
      maxSize: dto.maxSize ?? 10,
      notes: dto.notes ?? null,
    });

    return this.teamsRepository.save(team);
  }

  async findAll(scope: AccessScopeInfo = { all: true }): Promise<Team[]> {
    if (!scope.all && scope.groupIds.length === 0) return [];
    const teams = await this.teamsRepository.find({
      relations: {
        group: true,
        primaryAnimator: true,
        secondaryAnimator: true,
        members: { participant: { group: true } },
      },
      order: { name: 'ASC' },
    });
    return scope.all ? teams : teams.filter((team) => isTeamInScope(team, scope));
  }

  async findOne(id: number, scope: AccessScopeInfo = { all: true }): Promise<Team> {
    const team = await this.teamsRepository.findOne({
      where: { id },
      relations: {
        group: true,
        primaryAnimator: true,
        secondaryAnimator: true,
        members: { participant: { group: true } },
      },
    });

    if (!team || !isTeamInScope(team, scope)) {
      throw new NotFoundException(`Equipe ${id} introuvable`);
    }

    return team;
  }

  async update(
    id: number,
    dto: UpdateTeamDto,
    scope: AccessScopeInfo = { all: true },
  ): Promise<Team> {
    const team = await this.findOne(id, scope);
    // groupId : colonne de transition, écriture acceptée sans contrôle (jamais lue pour l'accès).
    if (Object.prototype.hasOwnProperty.call(dto, 'groupId')) {
      team.group = dto.groupId ? await this.groupsRepository.findOneBy({ id: dto.groupId }) : null;
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'primaryAnimatorId')) {
      team.primaryAnimator = dto.primaryAnimatorId
        ? await this.volunteersRepository.findOneBy({ id: dto.primaryAnimatorId })
        : null;
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'secondaryAnimatorId')) {
      team.secondaryAnimator = dto.secondaryAnimatorId
        ? await this.volunteersRepository.findOneBy({ id: dto.secondaryAnimatorId })
        : null;
    }

    Object.assign(team, {
      name: dto.name ?? team.name,
      maxSize: dto.maxSize ?? team.maxSize,
      notes: Object.prototype.hasOwnProperty.call(dto, 'notes') ? (dto.notes ?? null) : team.notes,
    });

    return this.teamsRepository.save(team);
  }

  async remove(id: number, scope: AccessScopeInfo = { all: true }): Promise<void> {
    const team = await this.findOne(id, scope);
    await this.teamsRepository.remove(team);
  }

  async getParticipants(
    teamId: number,
    scope: AccessScopeInfo = { all: true },
  ): Promise<Participant[]> {
    await this.findOne(teamId, scope);

    const teamParticipants = await this.teamParticipantsRepository.find({
      where: { team: { id: teamId } },
      relations: { participant: true },
    });

    const participantIds = teamParticipants.map((row) => row.participant.id);

    if (participantIds.length === 0) {
      return [];
    }

    return this.participantsRepository.find({
      where: participantIds.map((id) => ({
        id,
        ...(scope.all ? {} : { group: { id: In(scope.groupIds) } }),
      })),
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }
}
