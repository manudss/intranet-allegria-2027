import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group, Participant } from '../entities';
import { CreateParticipantDto, SearchParticipantsQuery, UpdateParticipantDto } from './participants.types';

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

  async search(filters: SearchParticipantsQuery) {
    const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
    const offset = Math.max(Number(filters.offset) || 0, 0);
    const query = this.participantsRepository
      .createQueryBuilder('participant')
      .leftJoinAndSelect('participant.group', 'group')
      .leftJoinAndSelect('participant.teamMemberships', 'membership')
      .leftJoinAndSelect('membership.team', 'team')
      .distinct(true)
      .orderBy('participant.lastName', 'ASC')
      .addOrderBy('participant.firstName', 'ASC');

    if (filters.type) query.andWhere('participant.type = :type', { type: filters.type });
    if (filters.teamId) query.andWhere('team.id = :teamId', { teamId: Number(filters.teamId) });
    if (filters.q?.trim()) {
      query.andWhere("concat_ws(' ', participant.firstName, participant.lastName) ILIKE :q", {
        q: `%${filters.q.trim()}%`,
      });
    }
    if (filters.unassignedOnly === true || filters.unassignedOnly === 'true') {
      // En l'absence de dates d'événement configurées, toute affectation non annulée est considérée active.
      query.andWhere((builder) => {
        const assigned = builder.subQuery()
          .select('1')
          .from('participant_host_family_assignments', 'assignment')
          .where('assignment.participant_id = participant.id')
          .andWhere('assignment.status != :cancelled')
          .getQuery();
        return `NOT EXISTS ${assigned}`;
      }).setParameter('cancelled', 'CANCELLED');
    }

    const [items, total] = await query.skip(offset).take(limit).getManyAndCount();
    return { items, total, limit, offset };
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


