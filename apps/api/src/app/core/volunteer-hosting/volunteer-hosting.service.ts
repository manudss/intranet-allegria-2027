import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HostFamily, Volunteer, VolunteerHostingAssignment, VolunteerHostingType } from '../entities';
import { CreateVolunteerHostingDto, UpdateVolunteerHostingDto } from './volunteer-hosting.types';

@Injectable()
export class VolunteerHostingService {
  constructor(
    @InjectRepository(VolunteerHostingAssignment)
    private readonly hostingRepository: Repository<VolunteerHostingAssignment>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepository: Repository<Volunteer>,
    @InjectRepository(HostFamily)
    private readonly hostFamiliesRepository: Repository<HostFamily>,
  ) {}

  findAll(volunteerId?: number): Promise<VolunteerHostingAssignment[]> {
    return this.hostingRepository.find({
      where: volunteerId ? { volunteerId } : {},
      relations: { volunteer: true, hostFamily: true },
      order: { id: 'ASC' },
    });
  }

  findByVolunteerId(volunteerId: number): Promise<VolunteerHostingAssignment | null> {
    return this.hostingRepository.findOne({
      where: { volunteerId },
      relations: { hostFamily: true },
    });
  }

  async create(dto: CreateVolunteerHostingDto): Promise<VolunteerHostingAssignment> {
    const volunteer = await this.volunteersRepository.findOne({ where: { id: dto.volunteerId } });
    if (!volunteer) {
      throw new NotFoundException(`Bénévole ${dto.volunteerId} introuvable`);
    }

    const existing = await this.findByVolunteerId(dto.volunteerId);
    if (existing) {
      throw new ConflictException('Ce bénévole a déjà un hébergement, utilisez la mise à jour');
    }

    const hostFamily = await this.resolveHostFamily(dto.type, dto.hostFamilyId ?? null);
    const { startAt, endAt } = this.normalizePeriod(dto.startAt ?? null, dto.endAt ?? null);

    const assignment = this.hostingRepository.create({
      volunteer,
      volunteerId: volunteer.id,
      type: dto.type,
      hostFamily,
      hostFamilyId: hostFamily?.id ?? null,
      locationName: this.normalizeOptionalText(dto.locationName ?? null),
      address: this.normalizeOptionalText(dto.address ?? null),
      room: this.normalizeOptionalText(dto.room ?? null),
      notes: this.normalizeOptionalText(dto.notes ?? null),
      startAt,
      endAt,
    });

    return this.hostingRepository.save(assignment);
  }

  async update(id: number, dto: UpdateVolunteerHostingDto): Promise<VolunteerHostingAssignment> {
    const assignment = await this.hostingRepository.findOne({
      where: { id },
      relations: { volunteer: true, hostFamily: true },
    });
    if (!assignment) {
      throw new NotFoundException(`Hébergement bénévole ${id} introuvable`);
    }

    if (dto.type !== undefined) {
      assignment.type = dto.type;
    }
    if (dto.hostFamilyId !== undefined || dto.type !== undefined) {
      const hostFamily = await this.resolveHostFamily(assignment.type, dto.hostFamilyId ?? assignment.hostFamilyId);
      assignment.hostFamily = hostFamily;
      assignment.hostFamilyId = hostFamily?.id ?? null;
    }
    if (dto.locationName !== undefined) {
      assignment.locationName = this.normalizeOptionalText(dto.locationName);
    }
    if (dto.address !== undefined) {
      assignment.address = this.normalizeOptionalText(dto.address);
    }
    if (dto.room !== undefined) {
      assignment.room = this.normalizeOptionalText(dto.room);
    }
    if (dto.notes !== undefined) {
      assignment.notes = this.normalizeOptionalText(dto.notes);
    }
    if (dto.startAt !== undefined || dto.endAt !== undefined) {
      const { startAt, endAt } = this.normalizePeriod(
        dto.startAt !== undefined ? dto.startAt : assignment.startAt,
        dto.endAt !== undefined ? dto.endAt : assignment.endAt,
      );
      assignment.startAt = startAt;
      assignment.endAt = endAt;
    }

    return this.hostingRepository.save(assignment);
  }

  async remove(id: number): Promise<void> {
    const assignment = await this.hostingRepository.findOne({ where: { id } });
    if (!assignment) {
      throw new NotFoundException(`Hébergement bénévole ${id} introuvable`);
    }
    await this.hostingRepository.remove(assignment);
  }

  private async resolveHostFamily(
    type: VolunteerHostingType,
    hostFamilyId: number | null,
  ): Promise<HostFamily | null> {
    if (type !== VolunteerHostingType.HOST_FAMILY) {
      return null;
    }
    if (hostFamilyId === null) {
      throw new BadRequestException('Une famille d accueil est requise pour ce type d hébergement');
    }
    const hostFamily = await this.hostFamiliesRepository.findOne({ where: { id: hostFamilyId } });
    if (!hostFamily) {
      throw new NotFoundException(`Famille d accueil ${hostFamilyId} introuvable`);
    }
    return hostFamily;
  }

  private normalizePeriod(
    startAt: string | null,
    endAt: string | null,
  ): { startAt: string | null; endAt: string | null } {
    const start = this.normalizeDate(startAt, 'startAt');
    const end = this.normalizeDate(endAt, 'endAt');
    if (start && end && end < start) {
      throw new BadRequestException('La date de fin doit suivre la date de début');
    }
    return { startAt: start, endAt: end };
  }

  private normalizeDate(value: string | null, field: string): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new BadRequestException(`Le champ ${field} doit être une date au format YYYY-MM-DD`);
    }
    return trimmed;
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
