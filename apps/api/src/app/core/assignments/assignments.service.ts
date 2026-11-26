import { Injectable, NotFoundException } from '@nestjs/common';
import type { AccessScopeInfo } from '../auth/access-module.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AssignmentStatus,
  HostFamily,
  Participant,
  ParticipantHostFamilyAssignment,
} from '../entities';
import { CreateAssignmentDto, UpdateAssignmentDto } from './assignments.types';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(ParticipantHostFamilyAssignment)
    private readonly assignmentsRepository: Repository<ParticipantHostFamilyAssignment>,
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    @InjectRepository(HostFamily)
    private readonly hostFamiliesRepository: Repository<HostFamily>,
  ) {}

  private inScope(scope: AccessScopeInfo, groupId?: number | null) {
    return scope.all || (groupId != null && scope.groupIds.includes(groupId));
  }

  private async assertParticipant(scope: AccessScopeInfo, participantId: number) {
    if (scope.all) return;
    const p = await this.participantsRepository.findOne({
      where: { id: participantId },
      relations: { group: true },
    });
    if (!p || !this.inScope(scope, p.group?.id)) {
      throw new NotFoundException(`Participant ${participantId} introuvable`);
    }
  }

  async create(
    dto: CreateAssignmentDto,
    scope: AccessScopeInfo = { all: true },
  ): Promise<ParticipantHostFamilyAssignment> {
    await this.assertParticipant(scope, dto.participantId);
    const participant = await this.participantsRepository.findOneBy({ id: dto.participantId });
    const hostFamily = await this.hostFamiliesRepository.findOneBy({ id: dto.hostFamilyId });

    if (!participant) {
      throw new NotFoundException(`Participant ${dto.participantId} introuvable`);
    }

    if (!hostFamily) {
      throw new NotFoundException(`Famille d'accueil ${dto.hostFamilyId} introuvable`);
    }

    const assignment = this.assignmentsRepository.create({
      participant,
      hostFamily,
      arrivalDate: dto.arrivalDate,
      departureDate: dto.departureDate,
      status: dto.status ?? AssignmentStatus.PENDING,
      notes: dto.notes ?? null,
      type: dto.type,
      groupId: dto.groupId ?? null,
      roomLabel: dto.roomLabel ?? null,
    });

    return this.assignmentsRepository.save(assignment);
  }

  findAll(scope: AccessScopeInfo = { all: true }): Promise<ParticipantHostFamilyAssignment[]> {
    if (!scope.all && !scope.groupIds.length) return Promise.resolve([]);
    return this.assignmentsRepository.find({
      where: scope.all ? undefined : { participant: { group: { id: In(scope.groupIds) } } },
      relations: { participant: true, hostFamily: true },
      order: { id: 'DESC' },
    });
  }

  findByHostFamily(
    hostFamilyId: number,
    scope: AccessScopeInfo = { all: true },
  ): Promise<ParticipantHostFamilyAssignment[]> {
    if (!scope.all && !scope.groupIds.length) return Promise.resolve([]);
    return this.assignmentsRepository.find({
      where: {
        hostFamily: { id: hostFamilyId },
        ...(scope.all ? {} : { participant: { group: { id: In(scope.groupIds) } } }),
      },
      relations: { participant: { group: true }, hostFamily: true },
      order: { arrivalDate: 'ASC', id: 'ASC' },
    });
  }

  async findOne(
    id: number,
    scope: AccessScopeInfo = { all: true },
  ): Promise<ParticipantHostFamilyAssignment> {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id },
      relations: { participant: { group: true }, hostFamily: true },
    });

    if (!assignment || !this.inScope(scope, assignment.participant?.group?.id)) {
      throw new NotFoundException(`Affectation ${id} introuvable`);
    }

    return assignment;
  }

  async update(
    id: number,
    dto: UpdateAssignmentDto,
    scope: AccessScopeInfo = { all: true },
  ): Promise<ParticipantHostFamilyAssignment> {
    const assignment = await this.findOne(id, scope);
    if (dto.participantId) await this.assertParticipant(scope, dto.participantId);

    if (Object.prototype.hasOwnProperty.call(dto, 'participantId')) {
      if (dto.participantId) {
        const participant = await this.participantsRepository.findOneBy({ id: dto.participantId });
        if (!participant) {
          throw new NotFoundException(`Participant ${dto.participantId} introuvable`);
        }
        assignment.participant = participant;
      }
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'hostFamilyId')) {
      if (dto.hostFamilyId) {
        const hostFamily = await this.hostFamiliesRepository.findOneBy({ id: dto.hostFamilyId });
        if (!hostFamily) {
          throw new NotFoundException(`Famille d'accueil ${dto.hostFamilyId} introuvable`);
        }
        assignment.hostFamily = hostFamily;
      }
    }

    Object.assign(assignment, {
      arrivalDate: dto.arrivalDate ?? assignment.arrivalDate,
      departureDate: dto.departureDate ?? assignment.departureDate,
      status: dto.status ?? assignment.status,
      notes: Object.prototype.hasOwnProperty.call(dto, 'notes')
        ? (dto.notes ?? null)
        : assignment.notes,
      type: dto.type ?? assignment.type,
      groupId: Object.prototype.hasOwnProperty.call(dto, 'groupId')
        ? (dto.groupId ?? null)
        : assignment.groupId,
      roomLabel: Object.prototype.hasOwnProperty.call(dto, 'roomLabel')
        ? (dto.roomLabel ?? null)
        : assignment.roomLabel,
    });

    return this.assignmentsRepository.save(assignment);
  }

  async remove(id: number, scope: AccessScopeInfo = { all: true }): Promise<void> {
    const assignment = await this.findOne(id, scope);
    await this.assignmentsRepository.remove(assignment);
  }
}
