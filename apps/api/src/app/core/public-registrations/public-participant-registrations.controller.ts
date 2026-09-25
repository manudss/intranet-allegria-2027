import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { PublicParticipantRegistrationResult } from '@mej-allegria/shared';
import { PublicRegistrationsService } from './public-registrations.service';
import { CreatePublicParticipantRegistrationDto } from './public-participant-registration.dto';

/**
 * Endpoint public (sans authentification) utilisé par le site public `site`
 * pour les pages /inscription/jeunes et /inscription/familles.
 *
 * Sécurité : validation stricte scopée à ce contrôleur (whitelist +
 * forbidNonWhitelisted), rate-limiting dédié (guard local, pas global), et
 * honeypot anti-bot. Les fiches créées sont marquées `status = PENDING` et
 * doivent être validées manuellement par un staff avant tout traitement.
 */
@ApiTags('Inscriptions publiques')
@Controller('public/participant-registrations')
@UseGuards(ThrottlerGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
@Throttle({ default: { limit: 5, ttl: 600_000 } })
export class PublicParticipantRegistrationsController {
  constructor(private readonly publicRegistrationsService: PublicRegistrationsService) {}

  @ApiOperation({
    summary: "Inscrire un ou plusieurs jeunes (formulaire public) — statut PENDING en attente de validation",
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePublicParticipantRegistrationDto,
  ): Promise<PublicParticipantRegistrationResult> {
    if (dto.honeypot) {
      // Piège à bots : on répond succès sans rien persister, sans révéler le piège.
      return { createdCount: dto.participants.length, status: 'PENDING' };
    }

    return this.publicRegistrationsService.createParticipantRegistration(dto);
  }
}
