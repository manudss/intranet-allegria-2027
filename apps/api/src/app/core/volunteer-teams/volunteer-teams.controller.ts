import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import {
  AccessModule,
  AccessLevelRequired,
  OwnTeamIds,
  OwnVolunteerIds,
  VolunteerScopeAware,
} from '../auth/access-module.decorator';
import {
  CreateVolunteerTeamDto,
  CreateVolunteerTeamMembershipDto,
  CreateVolunteerTeamTypeDto,
  UpdateVolunteerTeamDto,
  UpdateVolunteerTeamTypeDto,
  UpdateVolunteerTeamMembershipDto,
} from './volunteer-teams.types';
import { VolunteerTeamsService } from './volunteer-teams.service';

const READ_ROLES = ['ADMIN', 'COORDINATOR', 'HEALTH', 'VOLUNTEERS', 'LOGISTICS', 'VIEWER'];
const WRITE_ROLES = ['ADMIN', 'COORDINATOR'];

@ApiTags('VolunteerTeams')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller()
export class VolunteerTeamsController {
  constructor(private readonly volunteerTeamsService: VolunteerTeamsService) {}

  @ApiOperation({ summary: "Lister les types d'equipes operationnelles" })
  @AccessModule('OPERATIONAL_TEAMS')
  @Get('volunteer-team-types')
  findAllTeamTypes() {
    return this.volunteerTeamsService.findAllTeamTypes();
  }

  @ApiOperation({ summary: "Creer un type d'equipe operationnelle (admin)" })
  @AccessModule('ADMIN')
  @Post('volunteer-team-types')
  createTeamType(@Body() dto: CreateVolunteerTeamTypeDto) {
    return this.volunteerTeamsService.createTeamType(dto);
  }

  @ApiOperation({ summary: "Modifier un type d'equipe operationnelle (admin)" })
  @AccessModule('ADMIN')
  @Patch('volunteer-team-types/:id')
  updateTeamType(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVolunteerTeamTypeDto) {
    return this.volunteerTeamsService.updateTeamType(id, dto);
  }

  @ApiOperation({ summary: "Supprimer un type d'equipe operationnelle (admin)" })
  @AccessModule('ADMIN')
  @Delete('volunteer-team-types/:id')
  async removeTeamType(@Param('id', ParseIntPipe) id: number) {
    await this.volunteerTeamsService.removeTeamType(id);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Creer une equipe operationnelle' })
  @AccessModule('OPERATIONAL_TEAMS')
  @AccessLevelRequired('MANAGE')
  @Post('volunteer-teams')
  createTeam(@Body() dto: CreateVolunteerTeamDto) {
    return this.volunteerTeamsService.createTeam(dto);
  }

  @ApiOperation({ summary: 'Lister les equipes operationnelles' })
  @AccessModule('OPERATIONAL_TEAMS')
  @VolunteerScopeAware()
  @Get('volunteer-teams')
  findAllTeams(@OwnTeamIds() teamIds: number[] | null) {
    return this.volunteerTeamsService.findAllTeams(teamIds);
  }

  @ApiOperation({ summary: 'Recuperer une equipe operationnelle par id' })
  @AccessModule('OPERATIONAL_TEAMS')
  @VolunteerScopeAware()
  @Get('volunteer-teams/:id')
  findTeam(@Param('id', ParseIntPipe) id: number, @OwnTeamIds() teamIds: number[] | null) {
    return this.volunteerTeamsService.findVisibleTeam(id, teamIds);
  }

  @ApiOperation({ summary: 'Mettre a jour une equipe operationnelle' })
  @AccessModule('OPERATIONAL_TEAMS')
  @AccessLevelRequired('MANAGE')
  @Patch('volunteer-teams/:id')
  updateTeam(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVolunteerTeamDto) {
    return this.volunteerTeamsService.updateTeam(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer une equipe operationnelle' })
  @AccessModule('OPERATIONAL_TEAMS')
  @AccessLevelRequired('MANAGE')
  @Delete('volunteer-teams/:id')
  async removeTeam(@Param('id', ParseIntPipe) id: number) {
    await this.volunteerTeamsService.removeTeam(id);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Lister les rattachements d un benevole' })
  @AccessModule('OPERATIONAL_TEAMS')
  @VolunteerScopeAware()
  @Get('volunteers/:volunteerId/team-memberships')
  listVolunteerMemberships(
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @OwnVolunteerIds() ownVolunteerIds: number[] | null,
  ) {
    return this.volunteerTeamsService.listVolunteerMemberships(volunteerId, ownVolunteerIds);
  }

  @ApiOperation({ summary: 'Creer un rattachement d un benevole a une equipe operationnelle' })
  @AccessModule('OPERATIONAL_TEAMS')
  @AccessLevelRequired('MANAGE')
  @Post('volunteers/:volunteerId/team-memberships')
  createVolunteerMembership(
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @Body() dto: CreateVolunteerTeamMembershipDto,
  ) {
    return this.volunteerTeamsService.createVolunteerMembership(volunteerId, dto);
  }

  @ApiOperation({ summary: 'Mettre a jour un rattachement de benevole' })
  @AccessModule('OPERATIONAL_TEAMS')
  @AccessLevelRequired('MANAGE')
  @Patch('volunteers/:volunteerId/team-memberships/:membershipId')
  updateVolunteerMembership(
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @Param('membershipId', ParseIntPipe) membershipId: number,
    @Body() dto: UpdateVolunteerTeamMembershipDto,
  ) {
    return this.volunteerTeamsService.updateVolunteerMembership(volunteerId, membershipId, dto);
  }

  @ApiOperation({ summary: 'Supprimer un rattachement de benevole' })
  @AccessModule('OPERATIONAL_TEAMS')
  @AccessLevelRequired('MANAGE')
  @Delete('volunteers/:volunteerId/team-memberships/:membershipId')
  async removeVolunteerMembership(
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @Param('membershipId', ParseIntPipe) membershipId: number,
  ) {
    await this.volunteerTeamsService.removeVolunteerMembership(volunteerId, membershipId);
    return { deleted: true };
  }
}
