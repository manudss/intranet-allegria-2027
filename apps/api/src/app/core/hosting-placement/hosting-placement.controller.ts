import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { AccessModule, AccessLevelRequired } from '../auth/access-module.decorator';
import { HostingPlacementService } from './hosting-placement.service';
import {
  AssignToGroupDto,
  BulkAssignFamiliesDto,
  GroupFromParishesDto,
  AutoPlaceDto,
  HostingGroupDto,
  PlaceParticipantDto,
} from './hosting-placement.types';

const READ_ROLES = ['ADMIN', 'COORDINATOR', 'HEALTH', 'VOLUNTEERS', 'LOGISTICS', 'VIEWER'];
const WRITE_ROLES = ['ADMIN', 'COORDINATOR', 'LOGISTICS'];

@ApiTags('HostingPlacement')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller('hosting')
export class HostingPlacementController {
  constructor(private readonly service: HostingPlacementService) {}

  @ApiOperation({ summary: 'Vue complète pour le placement : groupes, équipes, familles, jeunes' })
  @AccessModule('HOUSING')
  @Get('board')
  board() {
    return this.service.board();
  }

  @ApiOperation({ summary: "Liste légère des groupes d'hébergement avec familles et places" })
  @AccessModule('HOUSING')
  @Get('groups')
  listGroups() {
    return this.service.listGroups();
  }

  @ApiOperation({ summary: "Créer un groupe d'hébergement" })
  @AccessModule('HOUSING')
  @AccessLevelRequired('EDIT')
  @Post('groups')
  createGroup(@Body() dto: HostingGroupDto) {
    return this.service.createGroup(dto);
  }

  @ApiOperation({ summary: "Modifier un groupe d'hébergement" })
  @AccessModule('HOUSING')
  @AccessLevelRequired('EDIT')
  @Patch('groups/:id')
  updateGroup(@Param('id', ParseIntPipe) id: number, @Body() dto: HostingGroupDto) {
    return this.service.updateGroup(id, dto);
  }

  @ApiOperation({
    summary: "Supprimer un groupe d'hébergement (refusé si des personnes y sont placées)",
  })
  @AccessModule('HOUSING')
  @AccessLevelRequired('EDIT')
  @Delete('groups/:id')
  async removeGroup(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeGroup(id);
    return { deleted: true };
  }

  @ApiOperation({
    summary: "Affecter une équipe de rassemblement à un groupe d'hébergement (null = retirer)",
  })
  @AccessModule('HOUSING')
  @AccessLevelRequired('EDIT')
  @Put('teams/:teamId/group')
  setTeamGroup(@Param('teamId', ParseIntPipe) teamId: number, @Body() dto: AssignToGroupDto) {
    return this.service.setTeamGroup(teamId, dto);
  }

  @ApiOperation({
    summary: "Affecter plusieurs familles d'un coup à un groupe d'hébergement (null = retirer)",
  })
  @AccessModule('HOUSING')
  @AccessLevelRequired('EDIT')
  @Put('families-group')
  setFamiliesGroup(@Body() dto: BulkAssignFamiliesDto) {
    return this.service.setFamiliesGroup(dto);
  }

  @ApiOperation({
    summary:
      'Créer un groupe par paroisse pour les familles sans groupe (ne déplace aucune famille déjà groupée)',
  })
  @AccessModule('HOUSING')
  @AccessLevelRequired('EDIT')
  @Post('groups/from-parishes')
  groupFromParishes(@Body() dto: GroupFromParishesDto) {
    return this.service.groupFromParishes(dto);
  }

  @ApiOperation({
    summary: "Affecter une famille d'accueil à un groupe d'hébergement (null = retirer)",
  })
  @AccessModule('HOUSING')
  @AccessLevelRequired('EDIT')
  @Put('families/:familyId/group')
  setFamilyGroup(@Param('familyId', ParseIntPipe) familyId: number, @Body() dto: AssignToGroupDto) {
    return this.service.setFamilyGroup(familyId, dto);
  }

  @ApiOperation({
    summary: 'Placer ou déplacer un participant dans une famille du groupe de son équipe',
  })
  @AccessModule('HOUSING')
  @AccessLevelRequired('EDIT')
  @Post('placements')
  place(@Body() dto: PlaceParticipantDto) {
    return this.service.place(dto);
  }

  @ApiOperation({ summary: "Retirer un participant de sa famille d'accueil" })
  @AccessModule('HOUSING')
  @AccessLevelRequired('EDIT')
  @Delete('placements/:participantId')
  unplace(@Param('participantId', ParseIntPipe) participantId: number) {
    return this.service.unplace(participantId);
  }

  @ApiOperation({
    summary: "Placement automatique d'un groupe : aperçu (défaut) ou enregistrement (apply=true)",
  })
  @AccessModule('HOUSING')
  @AccessLevelRequired('EDIT')
  @Post('groups/:id/auto-place')
  autoPlace(@Param('id', ParseIntPipe) id: number, @Body() dto: AutoPlaceDto) {
    return this.service.autoPlace(id, dto);
  }
}
