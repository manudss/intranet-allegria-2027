import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Volunteer, VolunteerSkill, VolunteerSkillType, VolunteerTag } from '../entities';
import { VolunteerTeamMembership } from '../entities/volunteer-team-membership.entity';
import { AddSkillDto, AddTagDto } from './volunteer-skills.types';

type SessionUser = { id: number; email: string; roles: string[] };

@Injectable()
export class VolunteerSkillsService {
  constructor(
    @InjectRepository(VolunteerSkill)
    private readonly skillsRepository: Repository<VolunteerSkill>,
    @InjectRepository(VolunteerTag)
    private readonly tagsRepository: Repository<VolunteerTag>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepository: Repository<Volunteer>,
    @InjectRepository(VolunteerTeamMembership)
    private readonly membershipsRepository: Repository<VolunteerTeamMembership>,
  ) {}

  async listSkills(volunteerId: number): Promise<VolunteerSkill[]> {
    await this.findVolunteer(volunteerId);
    return this.skillsRepository.find({
      where: { volunteerId },
      order: { skill: 'ASC' },
    });
  }

  async addSkill(actingUser: SessionUser, volunteerId: number, dto: AddSkillDto): Promise<VolunteerSkill> {
    await this.assertCanWrite(actingUser, volunteerId);
    await this.findVolunteer(volunteerId);

    const existing = await this.skillsRepository.findOneBy({ volunteerId, skill: dto.skill });
    if (existing) {
      throw new BadRequestException(`Le bénévole possède déjà la compétence ${dto.skill}`);
    }

    const skill = this.skillsRepository.create({ volunteerId, skill: dto.skill });
    return this.skillsRepository.save(skill);
  }

  async removeSkill(actingUser: SessionUser, volunteerId: number, skillId: number): Promise<void> {
    await this.assertCanWrite(actingUser, volunteerId);
    const skill = await this.skillsRepository.findOneBy({ id: skillId, volunteerId });
    if (!skill) {
      throw new NotFoundException(`Compétence ${skillId} introuvable pour le bénévole ${volunteerId}`);
    }
    await this.skillsRepository.remove(skill);
  }

  async listTags(volunteerId: number): Promise<VolunteerTag[]> {
    await this.findVolunteer(volunteerId);
    return this.tagsRepository.find({
      where: { volunteerId },
      order: { value: 'ASC' },
    });
  }

  async addTag(actingUser: SessionUser, volunteerId: number, dto: AddTagDto): Promise<VolunteerTag> {
    await this.assertCanWrite(actingUser, volunteerId);
    await this.findVolunteer(volunteerId);

    const normalized = this.normalizeTagValue(dto.value);
    const tag = this.tagsRepository.create({ volunteerId, value: normalized });
    return this.tagsRepository.save(tag);
  }

  async removeTag(actingUser: SessionUser, volunteerId: number, tagId: number): Promise<void> {
    await this.assertCanWrite(actingUser, volunteerId);
    const tag = await this.tagsRepository.findOneBy({ id: tagId, volunteerId });
    if (!tag) {
      throw new NotFoundException(`Tag ${tagId} introuvable pour le bénévole ${volunteerId}`);
    }
    await this.tagsRepository.remove(tag);
  }

  async getTagSuggestions(q?: string): Promise<string[]> {
    const qb = this.tagsRepository
      .createQueryBuilder('tag')
      .select('DISTINCT tag.value', 'value')
      .orderBy('tag.value', 'ASC');

    if (q && q.trim().length > 0) {
      const normalized = this.normalizeTagValue(q);
      qb.where('tag.value LIKE :pattern', { pattern: `${normalized}%` });
    }

    const rows = await qb.getRawMany<{ value: string }>();
    return rows.map((r) => r.value);
  }

  async getSkillUsageCounts(): Promise<{ skill: VolunteerSkillType; count: number }[]> {
    const rows = await this.skillsRepository
      .createQueryBuilder('skill')
      .select('skill.skill', 'skill')
      .addSelect('COUNT(*)', 'count')
      .groupBy('skill.skill')
      .getRawMany<{ skill: VolunteerSkillType; count: string }>();

    return rows.map((r) => ({ skill: r.skill, count: Number(r.count) }));
  }

  async assertCanWrite(actingUser: SessionUser, volunteerId: number): Promise<void> {
    const roles = actingUser.roles;

    if (roles.includes('ADMIN') || roles.includes('COORDINATOR')) {
      return;
    }

    if (roles.includes('VOLUNTEERS')) {
      const volunteer = await this.volunteersRepository.findOne({
        where: { id: volunteerId },
        relations: { user: true },
      });
      if (volunteer?.user?.id === actingUser.id) {
        return;
      }
      throw new ForbiddenException('Accès refusé : vous ne pouvez modifier que vos propres compétences et tags');
    }

    if (roles.includes('HEALTH')) {
      const membership = await this.membershipsRepository.findOne({
        where: { volunteerId },
        relations: { volunteerTeam: true },
      });
      const hasHealthMission = await this.membershipsRepository
        .createQueryBuilder('m')
        .innerJoin('m.volunteerTeam', 'team')
        .where('m.volunteer_id = :volunteerId', { volunteerId })
        .andWhere('UPPER(team.code) LIKE :pattern', { pattern: '%HEALTH%' })
        .getCount();

      if (hasHealthMission > 0) {
        return;
      }

      void membership;
      throw new ForbiddenException('Accès refusé : le bénévole n\'est pas concerné par une mission santé');
    }

    if (roles.includes('LOGISTICS')) {
      const hasLogisticsMission = await this.membershipsRepository
        .createQueryBuilder('m')
        .innerJoin('m.volunteerTeam', 'team')
        .where('m.volunteer_id = :volunteerId', { volunteerId })
        .andWhere('UPPER(team.code) LIKE :pattern', { pattern: '%LOGISTIC%' })
        .getCount();

      if (hasLogisticsMission > 0) {
        return;
      }

      throw new ForbiddenException('Accès refusé : le bénévole n\'est pas dans le périmètre logistique');
    }

    throw new ForbiddenException('Accès refusé');
  }

  private async findVolunteer(id: number): Promise<Volunteer> {
    const volunteer = await this.volunteersRepository.findOneBy({ id });
    if (!volunteer) {
      throw new NotFoundException(`Bénévole ${id} introuvable`);
    }
    return volunteer;
  }

  private normalizeTagValue(value: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('La valeur du tag ne peut pas être vide');
    }
    return value.trim().toLowerCase();
  }
}
