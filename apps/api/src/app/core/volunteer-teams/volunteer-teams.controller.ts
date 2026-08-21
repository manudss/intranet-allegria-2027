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
import { Roles } from '../auth/roles.decorator';
import {
  CreateVolunteerTeamDto,
  CreateVolunteerTeamMembershipDto,
  UpdateVolunteerTeamDto,
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

  @ApiOperation({ summary: 'Creer une equipe operationnelle' })
  @Roles(...WRITE_ROLES)
  @Post('volunteer-teams')
  createTeam(@Body() dto: CreateVolunteerTeamDto) {
    return this.volunteerTeamsService.createTeam(dto);
  }

  @ApiOperation({ summary: 'Lister les equipes operationnelles' })
  @Roles(...READ_ROLES)
  @Get('volunteer-teams')
  findAllTeams() {
    return this.volunteerTeamsService.findAllTeams();
  }

  @ApiOperation({ summary: 'Recuperer une equipe operationnelle par id' })
  @Roles(...READ_ROLES)
  @Get('volunteer-teams/:id')
  findTeam(@Param('id', ParseIntPipe) id: number) {
    return this.volunteerTeamsService.findTeam(id);
  }

  @ApiOperation({ summary: 'Mettre a jour une equipe operationnelle' })
  @Roles(...WRITE_ROLES)
  @Patch('volunteer-teams/:id')
  updateTeam(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVolunteerTeamDto) {
    return this.volunteerTeamsService.updateTeam(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer une equipe operationnelle' })
  @Roles(...WRITE_ROLES)
  @Delete('volunteer-teams/:id')
  async removeTeam(@Param('id', ParseIntPipe) id: number) {
    await this.volunteerTeamsService.removeTeam(id);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Lister les rattachements d un benevole' })
  @Roles(...READ_ROLES)
  @Get('volunteers/:volunteerId/team-memberships')
  listVolunteerMemberships(@Param('volunteerId', ParseIntPipe) volunteerId: number) {
    return this.volunteerTeamsService.listVolunteerMemberships(volunteerId);
  }

  @ApiOperation({ summary: 'Creer un rattachement d un benevole a une equipe operationnelle' })
  @Roles(...WRITE_ROLES)
  @Post('volunteers/:volunteerId/team-memberships')
  createVolunteerMembership(
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @Body() dto: CreateVolunteerTeamMembershipDto,
  ) {
    return this.volunteerTeamsService.createVolunteerMembership(volunteerId, dto);
  }

  @ApiOperation({ summary: 'Mettre a jour un rattachement de benevole' })
  @Roles(...WRITE_ROLES)
  @Patch('volunteers/:volunteerId/team-memberships/:membershipId')
  updateVolunteerMembership(
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @Param('membershipId', ParseIntPipe) membershipId: number,
    @Body() dto: UpdateVolunteerTeamMembershipDto,
  ) {
    return this.volunteerTeamsService.updateVolunteerMembership(volunteerId, membershipId, dto);
  }

  @ApiOperation({ summary: 'Supprimer un rattachement de benevole' })
  @Roles(...WRITE_ROLES)
  @Delete('volunteers/:volunteerId/team-memberships/:membershipId')
  async removeVolunteerMembership(
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @Param('membershipId', ParseIntPipe) membershipId: number,
  ) {
    await this.volunteerTeamsService.removeVolunteerMembership(volunteerId, membershipId);
    return { deleted: true };
  }
}
