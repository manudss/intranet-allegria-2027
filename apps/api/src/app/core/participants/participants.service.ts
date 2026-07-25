import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group, Participant } from '../entities';
import { CreateParticipantDto, UpdateParticipantDto } from './participants.types';

@Injectable()
export class ParticipantsService {
  constructor(
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
  ) {}

  async create(dto: CreateParticipantDto): Promise<Participant> {
    const participant = this.participantsRepository.create({
      ...dto,
      group: dto.groupId ? await this.groupsRepository.findOneBy({ id: dto.groupId }) : null,
    });

    return this.participantsRepository.save(participant);
  }

  async findAll(groupId?: number, diocese?: string): Promise<Participant[]> {
    const query = this.participantsRepository
      .createQueryBuilder('participant')
      .leftJoinAndSelect('participant.group', 'group')
      .orderBy('participant.lastName', 'ASC')
      .addOrderBy('participant.firstName', 'ASC');

    if (groupId) {
      query.andWhere('group.id = :groupId', { groupId });
    }

    if (diocese) {
      query.andWhere('participant.diocese = :diocese', { diocese });
    }

    return query.getMany();
  }

  async findOne(id: number): Promise<Participant> {
    const participant = await this.participantsRepository.findOne({
      where: { id },
      relations: { group: true },
    });

    if (!participant) {
      throw new NotFoundException(`Participant ${id} introuvable`);
    }

    return participant;
  }

  async update(id: number, dto: UpdateParticipantDto): Promise<Participant> {
    const participant = await this.findOne(id);

    if (Object.prototype.hasOwnProperty.call(dto, 'groupId')) {
      participant.group = dto.groupId ? await this.groupsRepository.findOneBy({ id: dto.groupId }) : null;
    }

    Object.assign(participant, dto);

    return this.participantsRepository.save(participant);
  }

  async remove(id: number): Promise<void> {
    const participant = await this.findOne(id);
    await this.participantsRepository.remove(participant);
  }
}


