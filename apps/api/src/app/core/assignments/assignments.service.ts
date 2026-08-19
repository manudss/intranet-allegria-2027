import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async create(dto: CreateAssignmentDto): Promise<ParticipantHostFamilyAssignment> {
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

  findAll(): Promise<ParticipantHostFamilyAssignment[]> {
    return this.assignmentsRepository.find({
      relations: { participant: true, hostFamily: true },
      order: { id: 'DESC' },
    });
  }

  findByHostFamily(hostFamilyId: number): Promise<ParticipantHostFamilyAssignment[]> {
    return this.assignmentsRepository.find({
      where: { hostFamily: { id: hostFamilyId } },
      relations: { participant: { group: true }, hostFamily: true },
      order: { arrivalDate: 'ASC', id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<ParticipantHostFamilyAssignment> {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id },
      relations: { participant: true, hostFamily: true },
    });

    if (!assignment) {
      throw new NotFoundException(`Affectation ${id} introuvable`);
    }

    return assignment;
  }

  async update(id: number, dto: UpdateAssignmentDto): Promise<ParticipantHostFamilyAssignment> {
    const assignment = await this.findOne(id);

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
      notes: Object.prototype.hasOwnProperty.call(dto, 'notes') ? dto.notes ?? null : assignment.notes,
      type: dto.type ?? assignment.type,
      groupId: Object.prototype.hasOwnProperty.call(dto, 'groupId') ? dto.groupId ?? null : assignment.groupId,
      roomLabel: Object.prototype.hasOwnProperty.call(dto, 'roomLabel') ? dto.roomLabel ?? null : assignment.roomLabel,
    });

    return this.assignmentsRepository.save(assignment);
  }

  async remove(id: number): Promise<void> {
    const assignment = await this.findOne(id);
    await this.assignmentsRepository.remove(assignment);
  }
}


