import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { PublicVolunteerApplicationResult } from '@mej-allegria/shared';
import { PublicRegistrationsService } from './public-registrations.service';
import { Public } from '../auth/public.decorator';
import { CreatePublicVolunteerApplicationDto } from './public-volunteer-application.dto';

/**
 * Endpoint public (sans authentification) utilisé par le site public `site`
 * pour la page /inscription/benevoles.
 *
 * Volontairement distinct de POST /api/volunteers (protégé staff) : une
 * candidature publique n'est PAS un bénévole opérationnel tant qu'elle n'a
 * pas été validée et convertie manuellement par un staff.
 */
@ApiTags('Inscriptions publiques')
@Public()
@Controller('public/volunteer-applications')
@UseGuards(ThrottlerGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
@Throttle({ default: { limit: 5, ttl: 600_000 } })
export class PublicVolunteerApplicationsController {
  constructor(private readonly publicRegistrationsService: PublicRegistrationsService) {}

  @ApiOperation({
    summary: 'Soumettre une candidature bénévole (formulaire public) — statut PENDING en attente de validation',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePublicVolunteerApplicationDto,
  ): Promise<PublicVolunteerApplicationResult> {
    if (dto.honeypot) {
      return { status: 'PENDING' };
    }

    return this.publicRegistrationsService.createVolunteerApplication(dto);
  }
}
