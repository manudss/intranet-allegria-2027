import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { PublicHostFamilyRegistrationResult } from '@mej-allegria/shared';
import { CreatePublicHostFamilyRegistrationDto } from './public-host-family-registration.dto';
import { PublicRegistrationsService } from './public-registrations.service';

/** Proposition publique d'accueil. La coordination valide et affecte les jeunes séparément. */
@ApiTags('Inscriptions publiques')
@Controller('public/host-family-registrations')
@UseGuards(ThrottlerGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
@Throttle({ default: { limit: 5, ttl: 600_000 } })
export class PublicHostFamilyRegistrationsController {
  constructor(private readonly publicRegistrationsService: PublicRegistrationsService) {}

  @ApiOperation({
    summary: 'Proposer un accueil — famille créée au statut DRAFT pour examen par la coordination',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePublicHostFamilyRegistrationDto,
  ): Promise<PublicHostFamilyRegistrationResult> {
    if (dto.honeypot) return { status: 'DRAFT' };
    return this.publicRegistrationsService.createHostFamilyRegistration(dto);
  }
}
