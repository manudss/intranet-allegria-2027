import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import {
  AccessLevelRequired,
  AccessModule,
  GatheringScope,
  GatheringScopeAware,
  GatheringScopeInfo,
} from '../auth/access-module.decorator';
import { GatheringGroupsService } from './gathering-groups.service';
import {
  ApplyAssignmentsDto,
  CreateGroupDto,
  CreateRepartitionDto,
  SetManagersDto,
  SetOverflowDto,
  UpdateGroupDto,
  UpdateRepartitionDto,
} from './gathering-groups.types';

/**
 * Groupes de rassemblement : module fermé par défaut (aucun accès sans règle de matrice),
 * contrôlé côté serveur. La portée « ses groupes » filtre sur les groupes dont le compte
 * est responsable ; la matrice décide le niveau.
 */
@ApiTags('GatheringGroups')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
@AccessModule('GATHERING_GROUPS')
@GatheringScopeAware()
@Controller('gathering')
export class GatheringGroupsController {
  constructor(private readonly service: GatheringGroupsService) {}

  @ApiOperation({
    summary:
      'Page centrale : répartitions du jour (liées à un événement) + autonomes, avec jauges',
  })
  @Get('repartitions')
  list(@Query('date') date: string | undefined, @GatheringScope() scope: GatheringScopeInfo) {
    return this.service.list(date, scope);
  }

  @ApiOperation({ summary: 'Créer une répartition (liée à un événement ou autonome)' })
  @AccessLevelRequired('EDIT')
  @Post('repartitions')
  createRepartition(@Body() dto: CreateRepartitionDto, @GatheringScope() scope: GatheringScopeInfo) {
    return this.service.createRepartition(dto, scope);
  }

  @ApiOperation({ summary: 'Modifier une répartition (nom, événement rattaché, comptage)' })
  @AccessLevelRequired('EDIT')
  @Patch('repartitions/:id')
  updateRepartition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRepartitionDto,
    @GatheringScope() scope: GatheringScopeInfo,
  ) {
    return this.service.updateRepartition(id, dto, scope);
  }

  @ApiOperation({ summary: 'Supprimer une répartition et ses groupes' })
  @AccessLevelRequired('EDIT')
  @Delete('repartitions/:id')
  async removeRepartition(@Param('id', ParseIntPipe) id: number, @GatheringScope() scope: GatheringScopeInfo) {
    await this.service.removeRepartition(id, scope);
    return { deleted: true };
  }

  @ApiOperation({
    summary:
      'Dérogation au dépassement bloquant (niveau Gérer requis) : acte explicite, par répartition',
  })
  @AccessLevelRequired('MANAGE')
  @Put('repartitions/:id/overflow')
  setOverflow(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetOverflowDto,
    @GatheringScope() scope: GatheringScopeInfo,
  ) {
    return this.service.setOverflow(id, dto.allowOverflow, scope);
  }

  @ApiOperation({
    summary: "Dupliquer la structure d'une répartition (groupes, sans les affectations ni responsables)",
  })
  @AccessLevelRequired('EDIT')
  @Post('repartitions/:id/duplicate')
  duplicate(
    @Param('id', ParseIntPipe) id: number,
    @Body('name') name: string | undefined,
    @GatheringScope() scope: GatheringScopeInfo,
  ) {
    return this.service.duplicateRepartition(id, name, scope);
  }

  @ApiOperation({ summary: "Répartitions rattachées à un événement de l'agenda (fiche événement)" })
  @Get('sequences/:sequenceId/repartitions')
  forSequence(
    @Param('sequenceId', ParseIntPipe) sequenceId: number,
    @GatheringScope() scope: GatheringScopeInfo,
  ) {
    return this.service.forSequence(sequenceId, scope);
  }

  @ApiOperation({ summary: 'Tableau de dispatch : équipes à placer + groupes avec jauges' })
  @Get('repartitions/:id/board')
  board(@Param('id', ParseIntPipe) id: number, @GatheringScope() scope: GatheringScopeInfo) {
    return this.service.board(id, scope);
  }

  @ApiOperation({
    summary: 'Proposition automatique de dispatch (aucune écriture, aperçu avant « Appliquer »)',
  })
  @AccessLevelRequired('VIEW')
  @Post('repartitions/:id/propose')
  propose(@Param('id', ParseIntPipe) id: number, @GatheringScope() scope: GatheringScopeInfo) {
    return this.service.propose(id, scope);
  }

  @ApiOperation({ summary: 'Appliquer des affectations en une transaction (groupId null = retirer)' })
  @AccessLevelRequired('EDIT')
  @Post('repartitions/:id/apply')
  apply(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApplyAssignmentsDto,
    @GatheringScope() scope: GatheringScopeInfo,
  ) {
    return this.service.apply(id, dto, scope);
  }

  @ApiOperation({ summary: 'Créer un groupe dans une répartition' })
  @AccessLevelRequired('EDIT')
  @Post('repartitions/:id/groups')
  createGroup(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateGroupDto,
    @GatheringScope() scope: GatheringScopeInfo,
  ) {
    return this.service.createGroup(id, dto, scope);
  }

  @ApiOperation({ summary: 'Fiche groupe : équipes, personnes, bénévoles à part, liens, alertes' })
  @Get('groups/:id')
  fiche(@Param('id', ParseIntPipe) id: number, @GatheringScope() scope: GatheringScopeInfo) {
    return this.service.fiche(id, scope);
  }

  @ApiOperation({ summary: 'Modifier un groupe (catégorie, capacité, lieu, liens)' })
  @AccessLevelRequired('EDIT')
  @Patch('groups/:id')
  updateGroup(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGroupDto,
    @GatheringScope() scope: GatheringScopeInfo,
  ) {
    return this.service.updateGroup(id, dto, scope);
  }

  @ApiOperation({ summary: 'Supprimer un groupe' })
  @AccessLevelRequired('EDIT')
  @Delete('groups/:id')
  async removeGroup(@Param('id', ParseIntPipe) id: number, @GatheringScope() scope: GatheringScopeInfo) {
    await this.service.removeGroup(id, scope);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Affecter une équipe entière au groupe (contrôle piste + capacité)' })
  @AccessLevelRequired('EDIT')
  @Put('groups/:id/teams/:teamId')
  assignTeam(
    @Param('id', ParseIntPipe) id: number,
    @Param('teamId', ParseIntPipe) teamId: number,
    @GatheringScope() scope: GatheringScopeInfo,
  ) {
    return this.service.assignTeam(id, teamId, scope);
  }

  @ApiOperation({ summary: 'Retirer une équipe du groupe' })
  @AccessLevelRequired('EDIT')
  @Delete('groups/:id/teams/:teamId')
  unassignTeam(
    @Param('id', ParseIntPipe) id: number,
    @Param('teamId', ParseIntPipe) teamId: number,
    @GatheringScope() scope: GatheringScopeInfo,
  ) {
    return this.service.unassignTeam(id, teamId, scope);
  }

  @ApiOperation({ summary: 'Rattacher une équipe opérationnelle (affichée à part des jeunes)' })
  @AccessLevelRequired('EDIT')
  @Put('groups/:id/volunteer-teams/:volunteerTeamId')
  attachVolunteerTeam(
    @Param('id', ParseIntPipe) id: number,
    @Param('volunteerTeamId', ParseIntPipe) volunteerTeamId: number,
    @GatheringScope() scope: GatheringScopeInfo,
  ) {
    return this.service.attachVolunteerTeam(id, volunteerTeamId, scope);
  }

  @ApiOperation({ summary: 'Détacher une équipe opérationnelle' })
  @AccessLevelRequired('EDIT')
  @Delete('groups/:id/volunteer-teams/:volunteerTeamId')
  detachVolunteerTeam(
    @Param('id', ParseIntPipe) id: number,
    @Param('volunteerTeamId', ParseIntPipe) volunteerTeamId: number,
    @GatheringScope() scope: GatheringScopeInfo,
  ) {
    return this.service.detachVolunteerTeam(id, volunteerTeamId, scope);
  }

  @ApiOperation({ summary: 'Créneaux de l\'agenda proposables pour lier un groupe' })
  @AccessModule('AGENDA')
  @Get('sequences')
  sequenceOptions() {
    return this.service.sequenceOptions();
  }

  @ApiOperation({ summary: 'Lier le groupe à un créneau de l\'agenda (indépendamment des autres groupes)' })
  @AccessLevelRequired('EDIT')
  @Put('groups/:id/sequences/:sequenceId')
  linkSequence(
    @Param('id', ParseIntPipe) id: number,
    @Param('sequenceId', ParseIntPipe) sequenceId: number,
    @GatheringScope() scope: GatheringScopeInfo,
  ) {
    return this.service.linkSequence(id, sequenceId, scope);
  }

  @ApiOperation({ summary: 'Retirer le lien du groupe avec un créneau (les autres liens restent)' })
  @AccessLevelRequired('EDIT')
  @Delete('groups/:id/sequences/:sequenceId')
  unlinkSequence(
    @Param('id', ParseIntPipe) id: number,
    @Param('sequenceId', ParseIntPipe) sequenceId: number,
    @GatheringScope() scope: GatheringScopeInfo,
  ) {
    return this.service.unlinkSequence(id, sequenceId, scope);
  }

  @ApiOperation({ summary: 'Responsables du groupe (périmètre « ses groupes »)' })
  @Get('groups/:id/managers')
  listManagers(@Param('id', ParseIntPipe) id: number, @GatheringScope() scope: GatheringScopeInfo) {
    return this.service.listManagers(id, scope);
  }

  @ApiOperation({
    summary:
      'Nommer les responsables (niveau Gérer requis) : la nomination fixe le périmètre, la matrice décide le niveau',
  })
  @AccessLevelRequired('MANAGE')
  @Put('groups/:id/managers')
  setManagers(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetManagersDto,
    @GatheringScope() scope: GatheringScopeInfo,
  ) {
    return this.service.setManagers(id, dto, scope);
  }
}
