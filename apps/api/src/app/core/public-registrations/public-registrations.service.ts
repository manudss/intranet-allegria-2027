import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type {
  PublicHostFamilyRegistrationResult,
  PublicParticipantRegistrationResult,
  PublicVolunteerApplicationResult,
} from '@mej-allegria/shared';
import {
  HostFamily,
  HostFamilyStatus,
  Participant,
  ParticipantRegistrationStatus,
  ParticipantSex,
  PersonSource,
  MejAgeGroup,
  VolunteerApplication,
} from '../entities';
import { CreatePublicParticipantRegistrationDto } from './public-participant-registration.dto';
import { CreatePublicVolunteerApplicationDto } from './public-volunteer-application.dto';
import { CreatePublicHostFamilyRegistrationDto } from './public-host-family-registration.dto';

@Injectable()
export class PublicRegistrationsService {
  private readonly logger = new Logger(PublicRegistrationsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(VolunteerApplication)
    private readonly volunteerApplicationsRepository: Repository<VolunteerApplication>,
    @InjectRepository(HostFamily)
    private readonly hostFamiliesRepository: Repository<HostFamily>,
  ) {}

  async createHostFamilyRegistration(
    dto: CreatePublicHostFamilyRegistrationDto,
  ): Promise<PublicHostFamilyRegistrationResult> {
    const family = this.hostFamiliesRepository.create({
      familyName: dto.familyName,
      address: dto.address,
      postalCode: dto.postalCode,
      city: dto.city,
      phone: dto.phone,
      email: dto.email,
      maxCapacity: dto.maxCapacity,
      maxUnder18: dto.maxUnder18,
      maxAnimators: dto.maxAnimators ?? null,
      parish: dto.parish || null,
      constraints: dto.constraints?.length ? dto.constraints : null,
      notes: dto.notes || null,
      latitude: null,
      longitude: null,
      tags: null,
      status: HostFamilyStatus.DRAFT,
    });
    await this.hostFamiliesRepository.save(family);
    this.logger.log("Nouvelle proposition de famille d'accueil à examiner");
    return { status: 'DRAFT' };
  }

  async createParticipantRegistration(
    dto: CreatePublicParticipantRegistrationDto,
  ): Promise<PublicParticipantRegistrationResult> {
    const createdCount = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Participant);
      const entries = dto.participants.map((entry) =>
        repository.create({
          firstName: entry.firstName,
          lastName: entry.lastName,
          dateOfBirth: entry.dateOfBirth,
          sex: entry.sex as ParticipantSex,
          mejAgeGroup: entry.mejAgeGroup as MejAgeGroup,
          diocese: entry.diocese ?? null,
          city: entry.city ?? null,
          emergencyContactName: dto.parentContact?.name ?? entry.emergencyContactName ?? null,
          emergencyContactPhone: dto.parentContact?.phone ?? entry.emergencyContactPhone ?? null,
          status: ParticipantRegistrationStatus.PENDING,
          source: PersonSource.PUBLIC_FORM,
        }),
      );

      const saved = await repository.save(entries);
      return saved.length;
    });

    this.logger.log(
      `Inscription publique : ${createdCount} participant(s) en attente de validation`,
    );

    return { createdCount, status: 'PENDING' };
  }

  async createVolunteerApplication(
    dto: CreatePublicVolunteerApplicationDto,
  ): Promise<PublicVolunteerApplicationResult> {
    const application = this.volunteerApplicationsRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      missionsOfInterest: dto.missionsOfInterest ?? null,
      availability: dto.availability ?? null,
      motivation: dto.motivation ?? null,
    });

    await this.volunteerApplicationsRepository.save(application);

    this.logger.log('Nouvelle candidature bénévole en attente de validation');

    return { status: 'PENDING' };
  }
}
