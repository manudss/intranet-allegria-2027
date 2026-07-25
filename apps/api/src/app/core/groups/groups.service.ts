import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group, Participant, Team } from '../entities';
import { CreateGroupDto, UpdateGroupDto } from './groups.types';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    @InjectRepository(Team)
    private readonly teamsRepository: Repository<Team>,
  ) {}

  create(dto: CreateGroupDto): Promise<Group> {
    const group = this.groupsRepository.create({
      ...dto,
      arrivalDatetime: dto.arrivalDatetime ? new Date(dto.arrivalDatetime) : null,
      departureDatetime: dto.departureDatetime ? new Date(dto.departureDatetime) : null,
    });

    return this.groupsRepository.save(group);
  }

  findAll(): Promise<Group[]> {
    return this.groupsRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<Group> {
    const group = await this.groupsRepository.findOneBy({ id });

    if (!group) {
      throw new NotFoundException(`Groupe ${id} introuvable`);
    }

    return group;
  }

  async update(id: number, dto: UpdateGroupDto): Promise<Group> {
    const group = await this.findOne(id);

    Object.assign(group, {
      ...dto,
      arrivalDatetime:
        Object.prototype.hasOwnProperty.call(dto, 'arrivalDatetime') && dto.arrivalDatetime
          ? new Date(dto.arrivalDatetime)
          : group.arrivalDatetime,
      departureDatetime:
        Object.prototype.hasOwnProperty.call(dto, 'departureDatetime') && dto.departureDatetime
          ? new Date(dto.departureDatetime)
          : group.departureDatetime,
    });

    return this.groupsRepository.save(group);
  }

  async remove(id: number): Promise<void> {
    const group = await this.findOne(id);
    await this.groupsRepository.remove(group);
  }

  getParticipants(groupId: number): Promise<Participant[]> {
    return this.participantsRepository.find({
      where: { group: { id: groupId } },
      relations: { group: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  getTeams(groupId: number): Promise<Team[]> {
    return this.teamsRepository.find({
      where: { group: { id: groupId } },
      relations: { group: true, primaryAnimator: true, secondaryAnimator: true },
      order: { name: 'ASC' },
    });
  }
}


