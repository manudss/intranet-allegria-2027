import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { JeunesRepartitionService } from './jeunes-repartition.service';
import {
  ApplyJeunesRepartitionDto,
  BulkCreateTeamsDto,
  ProposeRepartitionDto,
  RepartitionJeunesTeamsQueryDto,
  RepartitionParticipantsQueryDto,
} from './jeunes-repartition.types';

const READ_ROLES = ['ADMIN', 'COORDINATOR', 'ANIMATOR', 'LOGISTICS', 'VIEWER'];
const WRITE_ROLES = ['ADMIN', 'COORDINATOR', 'ANIMATOR'];

@ApiTags('JeunesRepartition')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller('jeunes/repartition')
export class JeunesRepartitionController {
  constructor(private readonly service: JeunesRepartitionService) {}

  @ApiOperation({ summary: 'Répartition jeunes : listes de valeurs des filtres (groupes, villes, diocèses, tranches)' })
  @Roles(...READ_ROLES)
  @Get('filters')
  filters() {
    return this.service.repartitionFilters();
  }

  @ApiOperation({
    summary:
      'Étape 1 : jeunes et animateurs filtrés (recherche, type, âge, sexe, origine, affectation). ' +
      'Confidentialité mineurs : le nom des jeunes n est jamais renvoyé.',
  })
  @Roles(...READ_ROLES)
  @Get('participants')
  participants(@Query() query: RepartitionParticipantsQueryDto) {
    return this.service.searchParticipants(query);
  }

  @ApiOperation({ summary: 'Étape 2 : équipes de rassemblement avec remplissage (recherche, groupe, places libres)' })
  @Roles(...READ_ROLES)
  @Get('teams')
  teams(@Query() query: RepartitionJeunesTeamsQueryDto) {
    return this.service.searchTeams(query);
  }

  @ApiOperation({ summary: 'Étape 2 : créer X équipes vides numérotées (ex. « Équipe 1 » … « Équipe 8 »)' })
  @Roles(...WRITE_ROLES)
  @Post('teams/bulk-create')
  bulkCreateTeams(@Body() dto: BulkCreateTeamsDto) {
    return this.service.bulkCreateTeams(dto);
  }

  @ApiOperation({
    summary:
      'Étape 3 : proposition automatique de répartition (taille cible, adultes, âge, mixité, origine). ' +
      'Aucune écriture : renvoie les affectations proposées et les violations de critères.',
  })
  @Roles(...READ_ROLES)
  @Post('propose')
  propose(@Body() dto: ProposeRepartitionDto) {
    return this.service.propose(dto);
  }

  @ApiOperation({ summary: 'Étape 3 : appliquer la répartition validée (une transaction ; teamId null = retirer)' })
  @Roles(...WRITE_ROLES)
  @Post('apply')
  apply(@Body() dto: ApplyJeunesRepartitionDto) {
    return this.service.apply(dto);
  }
}
