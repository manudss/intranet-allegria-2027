import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssignmentStatus, PersonType, Team, Volunteer, VolunteerTeamLodging } from '../entities';
import { CreateVolunteerHostingDto, UpdateVolunteerHostingDto, VolunteerLodgingView } from './volunteer-hosting.types';

@Injectable()
export class VolunteerHostingService {
  constructor(
    @InjectRepository(VolunteerTeamLodging)
    private readonly lodgingsRepository: Repository<VolunteerTeamLodging>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepository: Repository<Volunteer>,
    @InjectRepository(Team)
    private readonly teamsRepository: Repository<Team>,
  ) {}

  findAll(volunteerId?: number): Promise<VolunteerTeamLodging[]> {
    return this.lodgingsRepository.find({
      where: volunteerId ? { volunteerId } : {},
      relations: { volunteer: true, team: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Logement du bénévole connecté : équipe rattachée, ses animateurs,
   * les prénoms des jeunes (minimum exposé, sans contact) et les
   * familles d'accueil de l'équipe. Null si rien n'est saisi.
   */
  async findByVolunteerId(volunteerId: number): Promise<VolunteerLodgingView | null> {
    const lodging = await this.lodgingsRepository.findOne({
      where: { volunteerId },
      relations: {
        team: {
          primaryAnimator: true,
          secondaryAnimator: true,
          members: { participant: { hostFamilyAssignments: { hostFamily: true } } },
        },
      },
    });
    if (!lodging) {
      return null;
    }

    const team = lodging.team;
    const animators: VolunteerLodgingView['animators'] = [];
    if (team.primaryAnimator) {
      animators.push({
        id: team.primaryAnimator.id,
        firstName: team.primaryAnimator.firstName,
        lastName: team.primaryAnimator.lastName,
        role: 'PRIMARY',
        phone: team.primaryAnimator.phone,
      });
    }
    if (team.secondaryAnimator) {
      animators.push({
        id: team.secondaryAnimator.id,
        firstName: team.secondaryAnimator.firstName,
        lastName: team.secondaryAnimator.lastName,
        role: 'SECONDARY',
        phone: team.secondaryAnimator.phone,
      });
    }

    // Jeunes uniquement : les fiches BENEVOLE de l'équipe sont des adultes
    // (projections de bénévoles), elles n'apparaissent pas dans la liste des jeunes.
    const youths = (team.members ?? [])
      .filter((member) => member.participant.type === PersonType.JEUNE)
      .map((member) => ({ firstName: member.participant.firstName }))
      .sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr'));

    const families = new Map<number, VolunteerLodgingView['hostFamilies'][number]>();
    for (const member of team.members ?? []) {
      for (const assignment of member.participant.hostFamilyAssignments ?? []) {
        if (assignment.status === AssignmentStatus.CANCELLED) {
          continue;
        }
        const family = assignment.hostFamily;
        families.set(family.id, {
          id: family.id,
          familyName: family.familyName,
          address: family.address,
          postalCode: family.postalCode,
          city: family.city,
          phone: family.phone,
        });
      }
    }

    return {
      id: lodging.id,
      room: lodging.room,
      notes: lodging.notes,
      startAt: lodging.startAt,
      endAt: lodging.endAt,
      team: { id: team.id, name: team.name },
      animators,
      youths,
      hostFamilies: [...families.values()],
    };
  }

  async create(dto: CreateVolunteerHostingDto): Promise<VolunteerTeamLodging> {
    const volunteer = await this.volunteersRepository.findOne({ where: { id: dto.volunteerId } });
    if (!volunteer) {
      throw new NotFoundException(`Bénévole ${dto.volunteerId} introuvable`);
    }
    const team = await this.teamsRepository.findOne({ where: { id: dto.teamId } });
    if (!team) {
      throw new NotFoundException(`Équipe ${dto.teamId} introuvable`);
    }

    const existing = await this.lodgingsRepository.findOne({
      where: { volunteerId: dto.volunteerId },
    });
    if (existing) {
      throw new ConflictException('Ce bénévole a déjà un logement, utilisez la mise à jour');
    }

    const { startAt, endAt } = this.normalizePeriod(dto.startAt ?? null, dto.endAt ?? null);
    const lodging = this.lodgingsRepository.create({
      volunteer,
      volunteerId: volunteer.id,
      team,
      teamId: team.id,
      room: this.normalizeOptionalText(dto.room ?? null),
      notes: this.normalizeOptionalText(dto.notes ?? null),
      startAt,
      endAt,
    });

    return this.lodgingsRepository.save(lodging);
  }

  async update(id: number, dto: UpdateVolunteerHostingDto): Promise<VolunteerTeamLodging> {
    const lodging = await this.lodgingsRepository.findOne({
      where: { id },
      relations: { volunteer: true, team: true },
    });
    if (!lodging) {
      throw new NotFoundException(`Logement bénévole ${id} introuvable`);
    }

    if (dto.teamId !== undefined) {
      const team = await this.teamsRepository.findOne({ where: { id: dto.teamId } });
      if (!team) {
        throw new NotFoundException(`Équipe ${dto.teamId} introuvable`);
      }
      lodging.team = team;
      lodging.teamId = team.id;
    }
    if (dto.room !== undefined) {
      lodging.room = this.normalizeOptionalText(dto.room);
    }
    if (dto.notes !== undefined) {
      lodging.notes = this.normalizeOptionalText(dto.notes);
    }
    if (dto.startAt !== undefined || dto.endAt !== undefined) {
      const { startAt, endAt } = this.normalizePeriod(
        dto.startAt !== undefined ? dto.startAt : lodging.startAt,
        dto.endAt !== undefined ? dto.endAt : lodging.endAt,
      );
      lodging.startAt = startAt;
      lodging.endAt = endAt;
    }

    return this.lodgingsRepository.save(lodging);
  }

  async remove(id: number): Promise<void> {
    const lodging = await this.lodgingsRepository.findOne({ where: { id } });
    if (!lodging) {
      throw new NotFoundException(`Logement bénévole ${id} introuvable`);
    }
    await this.lodgingsRepository.remove(lodging);
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
