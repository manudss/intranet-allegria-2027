import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AccessScopeInfo } from '../auth/access-module.decorator';
import { In, Repository } from 'typeorm';
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

  private assertInScope(scope: AccessScopeInfo, id: number) {
    if (!scope.all && !scope.groupIds.includes(id)) {
      throw new NotFoundException(`Groupe ${id} introuvable`);
    }
  }

  create(dto: CreateGroupDto, scope: AccessScopeInfo = { all: true }): Promise<Group> {
    // Créer un groupe change le périmètre lui-même : réservé à la portée « tout ».
    if (!scope.all)
      throw new ForbiddenException('Création de groupe réservée à la portée complète');
    const group = this.groupsRepository.create({
      ...dto,
      arrivalDatetime: dto.arrivalDatetime ? new Date(dto.arrivalDatetime) : null,
      departureDatetime: dto.departureDatetime ? new Date(dto.departureDatetime) : null,
    });

    return this.groupsRepository.save(group);
  }

  findAll(scope: AccessScopeInfo = { all: true }): Promise<Group[]> {
    if (!scope.all) {
      if (scope.groupIds.length === 0) return Promise.resolve([]);
      return this.groupsRepository.find({
        where: { id: In(scope.groupIds) },
        order: { name: 'ASC' },
      });
    }
    return this.groupsRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number, scope: AccessScopeInfo = { all: true }): Promise<Group> {
    this.assertInScope(scope, id);
    const group = await this.groupsRepository.findOneBy({ id });

    if (!group) {
      throw new NotFoundException(`Groupe ${id} introuvable`);
    }

    return group;
  }

  async update(
    id: number,
    dto: UpdateGroupDto,
    scope: AccessScopeInfo = { all: true },
  ): Promise<Group> {
    const group = await this.findOne(id, scope);

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

  async remove(id: number, scope: AccessScopeInfo = { all: true }): Promise<void> {
    const group = await this.findOne(id, scope);
    await this.groupsRepository.remove(group);
  }

  getParticipants(groupId: number, scope: AccessScopeInfo = { all: true }): Promise<Participant[]> {
    this.assertInScope(scope, groupId);
    return this.participantsRepository.find({
      where: { group: { id: groupId } },
      relations: { group: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  getTeams(groupId: number, scope: AccessScopeInfo = { all: true }): Promise<Team[]> {
    this.assertInScope(scope, groupId);
    return this.teamsRepository.find({
      where: { group: { id: groupId } },
      relations: { group: true, primaryAnimator: true, secondaryAnimator: true },
      order: { name: 'ASC' },
    });
  }
}
