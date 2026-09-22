import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Volunteer } from '../entities';
import { CreateVolunteerDto, UpdateVolunteerDto } from './volunteers.types';
import { FindVolunteersQueryDto } from '../volunteer-skills/volunteer-skills.types';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectRepository(Volunteer)
    private readonly volunteersRepository: Repository<Volunteer>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateVolunteerDto): Promise<Volunteer> {
    const volunteer = this.volunteersRepository.create({
      ...dto,
      user: dto.userId ? await this.usersRepository.findOneBy({ id: dto.userId }) : null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      team: dto.team ?? null,
      isGroupLeader: dto.isGroupLeader ?? false,
      notes: dto.notes ?? null,
    });

    return this.volunteersRepository.save(volunteer);
  }

  findAll(query?: FindVolunteersQueryDto): Promise<Volunteer[]> {
    const qb = this.volunteersRepository
      .createQueryBuilder('volunteer')
      .leftJoinAndSelect('volunteer.user', 'user')
      .orderBy('volunteer.lastName', 'ASC')
      .addOrderBy('volunteer.firstName', 'ASC');

    if (query?.skill) {
      qb.innerJoin('volunteer.skills', 'skill', 'skill.skill = :skill', { skill: query.skill });
    }

    if (query?.tag) {
      const normalizedTag = query.tag.trim().toLowerCase();
      qb.innerJoin('volunteer.tags', 'tag', 'tag.value = :tag', { tag: normalizedTag });
    }

    return qb.getMany();
  }

  async findOne(id: number): Promise<Volunteer> {
    const volunteer = await this.volunteersRepository.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!volunteer) {
      throw new NotFoundException(`Benevole ${id} introuvable`);
    }

    return volunteer;
  }

  async update(id: number, dto: UpdateVolunteerDto): Promise<Volunteer> {
    const volunteer = await this.findOne(id);

    if (Object.prototype.hasOwnProperty.call(dto, 'userId')) {
      volunteer.user = dto.userId ? await this.usersRepository.findOneBy({ id: dto.userId }) : null;
    }

    Object.assign(volunteer, {
      ...dto,
      userId: undefined,
    });

    return this.volunteersRepository.save(volunteer);
  }

  async remove(id: number): Promise<void> {
    const volunteer = await this.findOne(id);
    await this.volunteersRepository.remove(volunteer);
  }
}
