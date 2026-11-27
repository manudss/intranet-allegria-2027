import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AccessScopeInfo } from '../auth/access-module.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Group, Participant, ProgramSequenceTrack, Team, TeamParticipant, Volunteer } from '../entities';
import { CreateTeamDto, UpdateTeamDto } from './teams.types';

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

  private assertGroupAllowed(scope: AccessScopeInfo, groupId?: number | null) {
    if (scope.all) return;
    if (groupId == null || !scope.groupIds.includes(Number(groupId))) {
      throw new ForbiddenException('Groupe hors de votre périmètre');
    }
  }

  async create(dto: CreateTeamDto, scope: AccessScopeInfo = { all: true }): Promise<Team> {
    this.assertGroupAllowed(scope, dto.groupId);
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
      track: dto.track ?? ProgramSequenceTrack.COMMON,
      notes: dto.notes ?? null,
    });

    return this.teamsRepository.save(team);
  }

  findAll(scope: AccessScopeInfo = { all: true }): Promise<Team[]> {
    if (!scope.all && scope.groupIds.length === 0) return Promise.resolve([]);
    return this.teamsRepository.find({
      where: scope.all ? undefined : { group: { id: In(scope.groupIds) } },
      relations: { group: true, primaryAnimator: true, secondaryAnimator: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number, scope: AccessScopeInfo = { all: true }): Promise<Team> {
    const team = await this.teamsRepository.findOne({
      where: { id },
      relations: { group: true, primaryAnimator: true, secondaryAnimator: true },
    });

    if (!team || (!scope.all && !scope.groupIds.includes(team.group?.id ?? -1))) {
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
    if (Object.prototype.hasOwnProperty.call(dto, 'groupId'))
      this.assertGroupAllowed(scope, dto.groupId);

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
      track: dto.track ?? team.track,
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
