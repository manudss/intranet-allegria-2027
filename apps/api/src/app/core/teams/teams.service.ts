import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group, Participant, Team, TeamParticipant, Volunteer } from '../entities';
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

  async create(dto: CreateTeamDto): Promise<Team> {
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

  findAll(): Promise<Team[]> {
    return this.teamsRepository.find({
      relations: ['group', 'primaryAnimator', 'secondaryAnimator'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Team> {
    const team = await this.teamsRepository.findOne({
      where: { id },
      relations: ['group', 'primaryAnimator', 'secondaryAnimator'],
    });

    if (!team) {
      throw new NotFoundException(`Equipe ${id} introuvable`);
    }

    return team;
  }

  async update(id: number, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(id);

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

  async remove(id: number): Promise<void> {
    const team = await this.findOne(id);
    await this.teamsRepository.remove(team);
  }

  async getParticipants(teamId: number): Promise<Participant[]> {
    await this.findOne(teamId);

    const teamParticipants = await this.teamParticipantsRepository.find({
      where: { team: { id: teamId } },
      relations: ['participant'],
    });

    const participantIds = teamParticipants.map((row) => row.participant.id);

    if (participantIds.length === 0) {
      return [];
    }

    return this.participantsRepository.find({
      where: participantIds.map((id) => ({ id })),
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }
}

