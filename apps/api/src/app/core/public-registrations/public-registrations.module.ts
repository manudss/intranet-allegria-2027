import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { HostFamily, Participant, VolunteerApplication } from '../entities';
import { PublicHostFamilyRegistrationsController } from './public-host-family-registrations.controller';
import { PublicParticipantRegistrationsController } from './public-participant-registrations.controller';
import { PublicVolunteerApplicationsController } from './public-volunteer-applications.controller';
import { PublicRegistrationsService } from './public-registrations.service';

/**
 * Module isolé regroupant les endpoints PUBLICS (sans authentification)
 * d'inscription. Le rate-limiting (`ThrottlerModule`/`ThrottlerGuard`) est
 * appliqué localement via `@UseGuards(ThrottlerGuard)` sur chaque contrôleur
 * de ce module — volontairement PAS via `APP_GUARD`, qui rendrait le guard
 * global et impacterait le reste de l'API (intranet staff).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([HostFamily, Participant, VolunteerApplication]),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 600_000, limit: 5 }]),
  ],
  controllers: [
    PublicParticipantRegistrationsController,
    PublicVolunteerApplicationsController,
    PublicHostFamilyRegistrationsController,
  ],
  providers: [PublicRegistrationsService],
})
export class PublicRegistrationsModule {}
