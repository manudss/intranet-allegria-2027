import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Participant, ParticipantHealth, User } from '../entities';
import { UpdateParticipantHealthDto } from './participant-health.types';

@Injectable()
export class ParticipantHealthService {
  constructor(
    @InjectRepository(ParticipantHealth)
    private readonly participantHealthRepository: Repository<ParticipantHealth>,
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getByParticipantId(participantId: number): Promise<ParticipantHealth | null> {
    await this.ensureParticipantExists(participantId);

    return this.participantHealthRepository.findOne({
      where: { participant: { id: participantId } },
      relations: { participant: true, lastUpdatedBy: true },
    });
  }

  async upsertByParticipantId(
    participantId: number,
    dto: UpdateParticipantHealthDto,
    updatedByUserId: number,
  ): Promise<ParticipantHealth> {
    const participant = await this.ensureParticipantExists(participantId);

    const updatedBy = await this.usersRepository.findOneBy({ id: updatedByUserId });

    if (!updatedBy) {
      throw new NotFoundException(`Utilisateur ${updatedByUserId} introuvable`);
    }

    const existing = await this.participantHealthRepository.findOne({
      where: { participant: { id: participantId } },
      relations: { participant: true, lastUpdatedBy: true },
    });

    const health = existing ?? this.participantHealthRepository.create({ participant });

    Object.assign(health, {
      ...dto,
      lastUpdatedAt: new Date(),
      lastUpdatedBy: updatedBy,
    });

    return this.participantHealthRepository.save(health);
  }

  private async ensureParticipantExists(participantId: number): Promise<Participant> {
    const participant = await this.participantsRepository.findOneBy({ id: participantId });

    if (!participant) {
      throw new NotFoundException(`Participant ${participantId} introuvable`);
    }

    return participant;
  }
}


