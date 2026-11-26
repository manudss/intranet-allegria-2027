import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Volunteer, VolunteerTeam, VolunteerTeamMembership, VolunteerTeamType } from '../entities';
import {
  CreateVolunteerTeamDto,
  CreateVolunteerTeamMembershipDto,
  CreateVolunteerTeamTypeDto,
  UpdateVolunteerTeamDto,
  UpdateVolunteerTeamTypeDto,
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
    @InjectRepository(VolunteerTeamType)
    private readonly teamTypesRepository: Repository<VolunteerTeamType>,
  ) {}

  async createTeam(dto: CreateVolunteerTeamDto): Promise<VolunteerTeam> {
    const team = this.volunteerTeamsRepository.create({
      name: this.requireTrimmedText(dto.name, 'name', 150),
      code: this.requireTrimmedText(dto.code, 'code', 80),
      description: this.normalizeOptionalText(dto.description),
      isActive: dto.isActive ?? true,
      typeId: await this.normalizeTypeId(dto.typeId),
    });

    const saved = await this.volunteerTeamsRepository.save(team);
    return this.findTeam(saved.id);
  }

  findAllTeams(): Promise<VolunteerTeam[]> {
    return this.volunteerTeamsRepository.find({
      relations: { type: true },
      order: { isActive: 'DESC', name: 'ASC', code: 'ASC' },
    });
  }

  async findTeam(id: number): Promise<VolunteerTeam> {
    const team = await this.volunteerTeamsRepository.findOne({
      where: { id },
      relations: { type: true },
    });

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

    if (Object.prototype.hasOwnProperty.call(dto, 'typeId')) {
      team.typeId = await this.normalizeTypeId(dto.typeId);
      // La relation chargee prendrait le pas sur typeId a l'enregistrement : on l'ecarte.
      team.type = undefined as never;
    }

    await this.volunteerTeamsRepository.save(team);
    return this.findTeam(id);
  }

  findAllTeamTypes(): Promise<VolunteerTeamType[]> {
    return this.teamTypesRepository.find({
      order: { isActive: 'DESC', sortOrder: 'ASC', label: 'ASC' },
    });
  }

  async createTeamType(dto: CreateVolunteerTeamTypeDto): Promise<VolunteerTeamType> {
    const code = this.normalizeTypeCode(dto.code);
    if (await this.teamTypesRepository.existsBy({ code })) {
      throw new ConflictException(`Un type d'equipe avec le code ${code} existe deja`);
    }
    return this.teamTypesRepository.save(
      this.teamTypesRepository.create({
        code,
        label: this.requireTrimmedText(dto.label, 'label', 120),
        description: this.normalizeOptionalText(dto.description),
        sortOrder: Number.isInteger(dto.sortOrder) ? (dto.sortOrder as number) : 0,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async updateTeamType(id: number, dto: UpdateVolunteerTeamTypeDto): Promise<VolunteerTeamType> {
    const type = await this.teamTypesRepository.findOneBy({ id });
    if (!type) {
      throw new NotFoundException(`Type d'equipe ${id} introuvable`);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'code')) {
      const code = this.normalizeTypeCode(dto.code);
      if (code !== type.code && (await this.teamTypesRepository.existsBy({ code }))) {
        throw new ConflictException(`Un type d'equipe avec le code ${code} existe deja`);
      }
      type.code = code;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'label')) {
      type.label = this.requireTrimmedText(dto.label, 'label', 120);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'description')) {
      type.description = this.normalizeOptionalText(dto.description);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'sortOrder') && Number.isInteger(dto.sortOrder)) {
      type.sortOrder = dto.sortOrder as number;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'isActive')) {
      type.isActive = dto.isActive ?? false;
    }
    return this.teamTypesRepository.save(type);
  }

  /** Les equipes rattachees perdent leur type (SET NULL) : pas de droit ni d'effet en cascade. */
  async removeTeamType(id: number): Promise<void> {
    const type = await this.teamTypesRepository.findOneBy({ id });
    if (!type) {
      throw new NotFoundException(`Type d'equipe ${id} introuvable`);
    }
    await this.teamTypesRepository.remove(type);
  }

  private async normalizeTypeId(typeId: number | null | undefined): Promise<number | null> {
    if (typeId === null || typeId === undefined) {
      return null;
    }
    const id = Number(typeId);
    if (!Number.isInteger(id) || !(await this.teamTypesRepository.existsBy({ id }))) {
      throw new BadRequestException(`Type d'equipe ${typeId} introuvable`);
    }
    return id;
  }

  private normalizeTypeCode(code: string | null | undefined): string {
    const normalized = String(code ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!normalized) {
      throw new BadRequestException('code est obligatoire');
    }
    return normalized.slice(0, 80);
  }

  async removeTeam(id: number): Promise<void> {
    const team = await this.findTeam(id);
    await this.volunteerTeamsRepository.remove(team);
  }

  async listTeammates(
    volunteerId: number,
    membershipId: number,
  ): Promise<VolunteerTeamMembership[]> {
    await this.findVolunteer(volunteerId);

    const membership = await this.membershipsRepository.findOne({
      where: { id: membershipId },
      relations: { volunteer: true },
    });

    if (!membership || membership.volunteerId !== volunteerId) {
      throw new NotFoundException('Aucune appartenance correspondante pour ce bénévole');
    }

    const teammates = await this.membershipsRepository.find({
      where: { volunteerTeamId: membership.volunteerTeamId },
      relations: { volunteer: true },
      order: { volunteer: { lastName: 'ASC', firstName: 'ASC' } },
    });

    return teammates.filter((teammate) => teammate.volunteerId !== volunteerId);
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

    if (
      Object.prototype.hasOwnProperty.call(dto, 'volunteerTeamId') &&
      dto.volunteerTeamId != null
    ) {
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

  private async findVolunteerMembership(
    volunteerId: number,
    membershipId: number,
  ): Promise<VolunteerTeamMembership> {
    const membership = await this.membershipsRepository.findOne({
      where: { id: membershipId, volunteer: { id: volunteerId } },
      relations: { volunteer: true, volunteerTeam: true },
    });

    if (!membership) {
      throw new NotFoundException(
        `Rattachement ${membershipId} du benevole ${volunteerId} introuvable`,
      );
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

  private requireTrimmedText(
    value: string | undefined,
    fieldName: string,
    maxLength: number,
  ): string {
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
