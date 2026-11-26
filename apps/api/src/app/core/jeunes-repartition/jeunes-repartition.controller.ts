import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import {
  AccessModule,
  AccessLevelRequired,
  AccessScope,
  AccessScopeInfo,
  GroupScopeAware,
} from '../auth/access-module.decorator';
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

  @ApiOperation({
    summary:
      'Répartition jeunes : listes de valeurs des filtres (groupes, villes, diocèses, tranches)',
  })
  @AccessModule('GATHERING_TEAMS')
  @GroupScopeAware()
  @Get('filters')
  filters(@AccessScope() scope: AccessScopeInfo) {
    return this.service.repartitionFilters(scope);
  }

  @ApiOperation({
    summary:
      'Étape 1 : jeunes et animateurs filtrés (recherche, type, âge, sexe, origine, affectation). ' +
      'Confidentialité mineurs : le nom des jeunes n est jamais renvoyé.',
  })
  @AccessModule('GATHERING_TEAMS')
  @GroupScopeAware()
  @Get('participants')
  participants(
    @Query() query: RepartitionParticipantsQueryDto,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.service.searchParticipants(query, scope);
  }

  @ApiOperation({
    summary:
      'Étape 2 : équipes de rassemblement avec remplissage (recherche, groupe, places libres)',
  })
  @AccessModule('GATHERING_TEAMS')
  @GroupScopeAware()
  @Get('teams')
  teams(@Query() query: RepartitionJeunesTeamsQueryDto, @AccessScope() scope: AccessScopeInfo) {
    return this.service.searchTeams(query, scope);
  }

  @ApiOperation({
    summary: 'Étape 2 : créer X équipes vides numérotées (ex. « Équipe 1 » … « Équipe 8 »)',
  })
  @AccessModule('GATHERING_TEAMS')
  @AccessLevelRequired('EDIT')
  @GroupScopeAware()
  @Post('teams/bulk-create')
  bulkCreateTeams(@Body() dto: BulkCreateTeamsDto, @AccessScope() scope: AccessScopeInfo) {
    return this.service.bulkCreateTeams(dto, scope);
  }

  @ApiOperation({
    summary:
      'Étape 3 : proposition automatique de répartition (taille cible, adultes, âge, mixité, origine). ' +
      'Aucune écriture : renvoie les affectations proposées et les violations de critères.',
  })
  @AccessModule('GATHERING_TEAMS')
  @AccessLevelRequired('VIEW')
  @GroupScopeAware()
  @Post('propose')
  propose(@Body() dto: ProposeRepartitionDto, @AccessScope() scope: AccessScopeInfo) {
    return this.service.propose(dto, scope);
  }

  @ApiOperation({
    summary: 'Étape 3 : appliquer la répartition validée (une transaction ; teamId null = retirer)',
  })
  @AccessModule('GATHERING_TEAMS')
  @AccessLevelRequired('EDIT')
  @GroupScopeAware()
  @Post('apply')
  apply(@Body() dto: ApplyJeunesRepartitionDto, @AccessScope() scope: AccessScopeInfo) {
    return this.service.apply(dto, scope);
  }
}
