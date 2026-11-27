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
  ValidationPipe,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AccessModule,
  AccessScope,
  AccessScopeInfo,
  GroupScopeAware,
} from '../auth/access-module.decorator';
import { RoleGuard } from '../auth/role.guard';
import { DelegationsService } from './delegations.service';

type UserRequest = { user: { id: number; email: string; roles: string[] } };
import {
  AssignTransportDto,
  CreateExceptionDto,
  CreateTransportDto,
  RepartitionQueryDto,
  TransportsQueryDto,
  UpdateTransportDto,
} from './delegations.types';

@ApiTags('Delegations')
@UseGuards(RoleGuard)
@AccessModule('TRANSPORT')
@GroupScopeAware()
@Controller('delegations')
export class DelegationsController {
  constructor(private readonly delegationsService: DelegationsService) {}

  @ApiOperation({ summary: 'Cartes des délégations visibles (effectifs, répartition, responsables)' })
  @Get()
  listSummaries(@AccessScope() scope: AccessScopeInfo) {
    return this.delegationsService.listSummaries(scope);
  }

  @ApiOperation({ summary: 'Sous-délégations (trajets) d une délégation' })
  @Get(':id/transports')
  listTransports(
    @Param('id', ParseIntPipe) id: number,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: TransportsQueryDto,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.delegationsService.listTransports(id, query.direction, scope);
  }

  @ApiOperation({ summary: 'Créer une sous-délégation (trajet)' })
  @Post(':id/transports')
  createTransport(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateTransportDto,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.delegationsService.createTransport(id, dto, scope);
  }

  @ApiOperation({ summary: 'Mettre à jour une sous-délégation' })
  @Patch('transports/:transportId')
  updateTransport(
    @Param('transportId', ParseIntPipe) transportId: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateTransportDto,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.delegationsService.updateTransport(transportId, dto, scope);
  }

  @ApiOperation({ summary: 'Supprimer une sous-délégation (les personnes retournent dans l à placer)' })
  @Delete('transports/:transportId')
  async removeTransport(
    @Param('transportId', ParseIntPipe) transportId: number,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    await this.delegationsService.removeTransport(transportId, scope);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Affecter une personne à un transport (déplace si déjà affectée)' })
  @Put('transports/:transportId/assignments')
  assign(
    @Param('transportId', ParseIntPipe) transportId: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: AssignTransportDto,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.delegationsService.assign(transportId, dto, scope);
  }

  @ApiOperation({ summary: 'Créer une exception vers une autre délégation (créable des deux côtés)' })
  @Post(':id/exceptions')
  async createException(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateExceptionDto,
    @Req() req: UserRequest,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    const author = await this.delegationsService.resolveAuthor(
      req.user.id,
      req.user.email,
      req.user.roles,
    );
    return this.delegationsService.createException(id, dto, scope, author);
  }

  @ApiOperation({ summary: 'Retirer une affectation (retour dans l à placer de la délégation d origine)' })
  @Delete('assignments/:assignmentId')
  async unassign(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    await this.delegationsService.unassign(assignmentId, scope);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Membres de la délégation (jeunes et bénévoles) pour le sélecteur de personne' })
  @Get(':id/persons')
  persons(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    return this.delegationsService.persons(id, scope);
  }

  @ApiOperation({ summary: 'Vue répartition : à placer, transports et exceptions pour un sens' })
  @Get(':id/repartition')
  repartition(
    @Param('id', ParseIntPipe) id: number,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: RepartitionQueryDto,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.delegationsService.repartition(id, query.direction, scope);
  }

  @ApiOperation({ summary: 'Trajets aller/retour pour la fiche personne (projection bénévole résolue)' })
  @Get('fiches/:participantId/journeys')
  journeys(
    @Param('participantId', ParseIntPipe) participantId: number,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.delegationsService.journeysForParticipantFiche(participantId, scope);
  }

  @ApiOperation({ summary: 'Totaux par sens : exceptions reçues comprises, sortantes exclues' })
  @Get(':id/stats')
  stats(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    return this.delegationsService.stats(id, scope);
  }
}
