import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { VolunteerHostingService } from '../volunteer-hosting/volunteer-hosting.service';
import { UpdateMyVolunteerDto } from './my-space.types';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { Volunteer } from '../entities';
import { VolunteerShiftAssignmentsService } from '../volunteer-shift-assignments/volunteer-shift-assignments.service';
import { VolunteerPlanningQueryDto } from '../volunteer-shift-assignments/volunteer-shift-assignments.types';
import { VolunteerTeamsService } from '../volunteer-teams/volunteer-teams.service';
import { VolunteersService } from '../volunteers/volunteers.service';

const READ_ROLES = ['ADMIN', 'COORDINATOR', 'HEALTH', 'VOLUNTEERS', 'LOGISTICS', 'VIEWER'];

type UserRequest = { user: { id: number; email: string; roles: string[] } };

@ApiTags('MySpace')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller('me')
export class MySpaceController {
  constructor(
    private readonly volunteersService: VolunteersService,
    private readonly assignmentsService: VolunteerShiftAssignmentsService,
    private readonly volunteerTeamsService: VolunteerTeamsService,
    private readonly volunteerHostingService: VolunteerHostingService,
  ) {}

  @ApiOperation({ summary: 'Profil bénévole de l utilisateur authentifié' })
  @Roles(...READ_ROLES)
  @Get('volunteer')
  async getMyVolunteer(@Req() req: UserRequest): Promise<Volunteer> {
    return this.findMyVolunteer(req);
  }

  @ApiOperation({ summary: 'Mettre à jour les coordonnées du bénévole authentifié (téléphone, email)' })
  @Roles(...READ_ROLES)
  @Patch('volunteer')
  async updateMyVolunteer(@Req() req: UserRequest, @Body() dto: UpdateMyVolunteerDto) {
    return this.volunteersService.updateOwnProfile(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Planning des affectations du bénévole authentifié' })
  @Roles(...READ_ROLES)
  @Get('shift-assignments')
  async getMyShiftAssignments(@Req() req: UserRequest, @Query() query: VolunteerPlanningQueryDto) {
    const volunteer = await this.findMyVolunteer(req);
    return this.assignmentsService.listVolunteerPlanning(req.user, volunteer.id, query.status);
  }

  @ApiOperation({ summary: 'Équipes opérationnelles du bénévole authentifié' })
  @Roles(...READ_ROLES)
  @Get('team-memberships')
  async getMyTeamMemberships(@Req() req: UserRequest) {
    const volunteer = await this.findMyVolunteer(req);
    return this.volunteerTeamsService.listVolunteerMemberships(volunteer.id);
  }

  @ApiOperation({ summary: 'Équipiers d une appartenance du bénévole authentifié' })
  @Roles(...READ_ROLES)
  @Get('team-memberships/:id/members')
  async getMyTeammates(@Req() req: UserRequest, @Param('id', ParseIntPipe) membershipId: number) {
    const volunteer = await this.findMyVolunteer(req);
    return this.volunteerTeamsService.listTeammates(volunteer.id, membershipId);
  }

  @ApiOperation({ summary: 'Hébergement du bénévole authentifié, null si non défini' })
  @Roles(...READ_ROLES)
  @Get('hosting')
  async getMyHosting(@Req() req: UserRequest) {
    const volunteer = await this.findMyVolunteer(req);
    return this.volunteerHostingService.findByVolunteerId(volunteer.id);
  }

  private async findMyVolunteer(req: UserRequest): Promise<Volunteer> {
    const volunteer = await this.volunteersService.findByUserId(req.user.id);
    if (!volunteer) {
      throw new NotFoundException('Aucun profil bénévole rattaché à cet utilisateur');
    }
    return volunteer;
  }
}
