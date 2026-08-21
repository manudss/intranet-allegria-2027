import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Volunteer, VolunteerTeam, VolunteerTeamMembership } from '../entities';
import {
  CreateVolunteerTeamDto,
  CreateVolunteerTeamMembershipDto,
  UpdateVolunteerTeamDto,
  UpdateVolunteerTeamMembershipDto,
} from './volunteer-teams.types';

const READABLE_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class VolunteerTeamsService {
  constructor(
    @InjectRepository(VolunteerTeam)
    private readonly volunteerTeamsRepository: Repository<VolunteerTeam>,
    @InjectRepository(VolunteerTeamMembership)
    private readonly membershipsRepository: Repository<VolunteerTeamMembership>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepository: Repository<Volunteer>,
  ) {}

  async createTeam(dto: CreateVolunteerTeamDto): Promise<VolunteerTeam> {
    const team = this.volunteerTeamsRepository.create({
      name: this.requireTrimmedText(dto.name, 'name', 150),
      code: this.requireTrimmedText(dto.code, 'code', 80),
      description: this.normalizeOptionalText(dto.description),
      isActive: dto.isActive ?? true,
    });

    return this.volunteerTeamsRepository.save(team);
  }

  findAllTeams(): Promise<VolunteerTeam[]> {
    return this.volunteerTeamsRepository.find({
      order: { isActive: 'DESC', name: 'ASC', code: 'ASC' },
    });
  }

  async findTeam(id: number): Promise<VolunteerTeam> {
    const team = await this.volunteerTeamsRepository.findOneBy({ id });

    if (!team) {
      throw new NotFoundException(`Equipe operationnelle ${id} introuvable`);
    }

    return team;
  }

  async updateTeam(id: number, dto: UpdateVolunteerTeamDto): Promise<VolunteerTeam> {
    const team = await this.findTeam(id);

    if (Object.prototype.hasOwnProperty.call(dto, 'name')) {
      team.name = this.requireTrimmedText(dto.name, 'name', 150);
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'code')) {
      team.code = this.requireTrimmedText(dto.code, 'code', 80);
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'description')) {
      team.description = this.normalizeOptionalText(dto.description);
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'isActive')) {
      team.isActive = dto.isActive ?? false;
    }

    return this.volunteerTeamsRepository.save(team);
  }

  async removeTeam(id: number): Promise<void> {
    const team = await this.findTeam(id);
    await this.volunteerTeamsRepository.remove(team);
  }

  async listVolunteerMemberships(volunteerId: number): Promise<VolunteerTeamMembership[]> {
    await this.findVolunteer(volunteerId);

    return this.membershipsRepository.find({
      where: { volunteer: { id: volunteerId } },
      relations: { volunteer: true, volunteerTeam: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createVolunteerMembership(
    volunteerId: number,
    dto: CreateVolunteerTeamMembershipDto,
  ): Promise<VolunteerTeamMembership> {
    const volunteer = await this.findVolunteer(volunteerId);
    const volunteerTeam = await this.findTeam(dto.volunteerTeamId);
    const startAt = this.normalizeDate(dto.startAt ?? null, 'startAt');
    const endAt = this.normalizeDate(dto.endAt ?? null, 'endAt');

    this.validatePeriod(startAt, endAt);
    await this.ensureMembershipIsUnique(volunteer.id, volunteerTeam.id, startAt);

    const membership = this.membershipsRepository.create({
      volunteer,
      volunteerId: volunteer.id,
      volunteerTeam,
      volunteerTeamId: volunteerTeam.id,
      startAt,
      endAt,
      role: this.normalizeOptionalText(dto.role),
    });

    return this.saveMembership(membership);
  }

  async updateVolunteerMembership(
    volunteerId: number,
    membershipId: number,
    dto: UpdateVolunteerTeamMembershipDto,
  ): Promise<VolunteerTeamMembership> {
    const membership = await this.findVolunteerMembership(volunteerId, membershipId);

    if (Object.prototype.hasOwnProperty.call(dto, 'volunteerTeamId') && dto.volunteerTeamId != null) {
      membership.volunteerTeam = await this.findTeam(dto.volunteerTeamId);
      membership.volunteerTeamId = membership.volunteerTeam.id;
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'startAt')) {
      membership.startAt = this.normalizeDate(dto.startAt ?? null, 'startAt');
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'endAt')) {
      membership.endAt = this.normalizeDate(dto.endAt ?? null, 'endAt');
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'role')) {
      membership.role = this.normalizeOptionalText(dto.role);
    }

    this.validatePeriod(membership.startAt, membership.endAt);
    await this.ensureMembershipIsUnique(
      membership.volunteer.id,
      membership.volunteerTeam.id,
      membership.startAt,
      membership.id,
    );

    return this.saveMembership(membership);
  }

  async removeVolunteerMembership(volunteerId: number, membershipId: number): Promise<void> {
    const membership = await this.findVolunteerMembership(volunteerId, membershipId);
    await this.membershipsRepository.remove(membership);
  }

  private async findVolunteer(id: number): Promise<Volunteer> {
    const volunteer = await this.volunteersRepository.findOneBy({ id });

    if (!volunteer) {
      throw new NotFoundException(`Benevole ${id} introuvable`);
    }

    return volunteer;
  }

  private async findVolunteerMembership(volunteerId: number, membershipId: number): Promise<VolunteerTeamMembership> {
    const membership = await this.membershipsRepository.findOne({
      where: { id: membershipId, volunteer: { id: volunteerId } },
      relations: { volunteer: true, volunteerTeam: true },
    });

    if (!membership) {
      throw new NotFoundException(`Rattachement ${membershipId} du benevole ${volunteerId} introuvable`);
    }

    return membership;
  }

  private async ensureMembershipIsUnique(
    volunteerId: number,
    volunteerTeamId: number,
    startAt: string | null,
    excludedMembershipId?: number,
  ): Promise<void> {
    const query = this.membershipsRepository
      .createQueryBuilder('membership')
      .innerJoin('membership.volunteer', 'volunteer')
      .innerJoin('membership.volunteerTeam', 'volunteerTeam')
      .where('volunteer.id = :volunteerId', { volunteerId })
      .andWhere('volunteerTeam.id = :volunteerTeamId', { volunteerTeamId });

    if (startAt === null) {
      query.andWhere('membership.startAt IS NULL');
    } else {
      query.andWhere('membership.startAt = :startAt', { startAt });
    }

    if (excludedMembershipId) {
      query.andWhere('membership.id != :excludedMembershipId', { excludedMembershipId });
    }

    const existing = await query.getOne();

    if (existing) {
      throw new ConflictException('Ce rattachement existe deja pour ce benevole et cette equipe');
    }
  }

  private validatePeriod(startAt: string | null, endAt: string | null): void {
    if (startAt === null || endAt === null) {
      return;
    }

    if (endAt <= startAt) {
      throw new BadRequestException('endAt doit etre posterieur a startAt');
    }
  }

  private normalizeDate(value: string | null, fieldName: string): string | null {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return null;
    }

    if (!READABLE_DATE.test(trimmed)) {
      throw new BadRequestException(`${fieldName} doit respecter le format YYYY-MM-DD`);
    }

    const parsed = new Date(`${trimmed}T00:00:00.000Z`);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} est invalide`);
    }

    const [year, month, day] = trimmed.split('-').map((part) => Number(part));

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${fieldName} est invalide`);
    }

    return trimmed;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private requireTrimmedText(value: string | undefined, fieldName: string, maxLength: number): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} est obligatoire`);
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      throw new BadRequestException(`${fieldName} est obligatoire`);
    }

    if (trimmed.length > maxLength) {
      throw new BadRequestException(`${fieldName} ne doit pas depasser ${maxLength} caracteres`);
    }

    return trimmed;
  }

  private async saveMembership(
    membership: VolunteerTeamMembership,
  ): Promise<VolunteerTeamMembership> {
    const savedMembership = await this.membershipsRepository.save(membership);
    return this.membershipsRepository.findOneOrFail({
      where: { id: savedMembership.id },
      relations: { volunteer: true, volunteerTeam: true },
    });
  }
}
