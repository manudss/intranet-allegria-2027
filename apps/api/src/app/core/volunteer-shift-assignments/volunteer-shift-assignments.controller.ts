import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import {
  CancelVolunteerShiftAssignmentDto,
  ChangeVolunteerShiftAssignmentStatusDto,
  CreateVolunteerShiftAssignmentDto,
  ListShiftAssignmentsQueryDto,
  SearchShiftAssignmentVolunteerQueryDto,
  VolunteerPlanningQueryDto,
} from './volunteer-shift-assignments.types';
import { VolunteerShiftAssignmentsService } from './volunteer-shift-assignments.service';

const READ_ROLES = ['ADMIN', 'COORDINATOR', 'HEALTH', 'ANIMATOR', 'LOGISTICS', 'VOLUNTEERS', 'VIEWER'];
const WRITE_ROLES = ['ADMIN', 'COORDINATOR', 'HEALTH', 'ANIMATOR', 'LOGISTICS', 'VOLUNTEERS'];

type UserRequest = { user: { id: number; email: string; roles: string[] } };

@ApiTags('VolunteerShiftAssignments')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller()
export class VolunteerShiftAssignmentsController {
  constructor(private readonly assignmentsService: VolunteerShiftAssignmentsService) {}

  @ApiOperation({ summary: 'Rechercher des benevoles pour une affectation de shift' })
  @Roles(...READ_ROLES)
  @Get('volunteer-shift-assignments/volunteer-search')
  searchVolunteers(@Req() req: UserRequest, @Query() query: SearchShiftAssignmentVolunteerQueryDto) {
    return this.assignmentsService.searchVolunteers(req.user, query);
  }

  @ApiOperation({ summary: 'Lister les affectations d un shift' })
  @Roles(...READ_ROLES)
  @Get('volunteer-missions/:missionId/shifts/:shiftId/assignments')
  listForShift(
    @Req() req: UserRequest,
    @Param('missionId', ParseIntPipe) missionId: number,
    @Param('shiftId', ParseIntPipe) shiftId: number,
    @Query() query: ListShiftAssignmentsQueryDto,
  ) {
    return this.assignmentsService.listForShift(req.user, missionId, shiftId, query.status);
  }

  @ApiOperation({ summary: 'Affecter un benevole a un shift' })
  @Roles(...WRITE_ROLES)
  @Post('volunteer-missions/:missionId/shifts/:shiftId/assignments')
  create(
    @Req() req: UserRequest,
    @Param('missionId', ParseIntPipe) missionId: number,
    @Param('shiftId', ParseIntPipe) shiftId: number,
    @Body() dto: CreateVolunteerShiftAssignmentDto,
  ) {
    return this.assignmentsService.create(req.user, missionId, shiftId, dto);
  }

  @ApiOperation({ summary: 'Changer le statut d une affectation de shift' })
  @Roles(...WRITE_ROLES)
  @Patch('volunteer-missions/:missionId/shifts/:shiftId/assignments/:assignmentId/status')
  changeStatus(
    @Req() req: UserRequest,
    @Param('missionId', ParseIntPipe) missionId: number,
    @Param('shiftId', ParseIntPipe) shiftId: number,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() dto: ChangeVolunteerShiftAssignmentStatusDto,
  ) {
    return this.assignmentsService.changeStatus(req.user, missionId, shiftId, assignmentId, dto);
  }

  @ApiOperation({ summary: 'Annuler une affectation de shift' })
  @Roles(...WRITE_ROLES)
  @Post('volunteer-missions/:missionId/shifts/:shiftId/assignments/:assignmentId/cancel')
  cancel(
    @Req() req: UserRequest,
    @Param('missionId', ParseIntPipe) missionId: number,
    @Param('shiftId', ParseIntPipe) shiftId: number,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() dto: CancelVolunteerShiftAssignmentDto,
  ) {
    return this.assignmentsService.cancel(req.user, missionId, shiftId, assignmentId, dto);
  }

  @ApiOperation({ summary: 'Afficher le planning d affectation d un benevole' })
  @Roles(...READ_ROLES)
  @Get('volunteers/:volunteerId/shift-assignments')
  listVolunteerPlanning(
    @Req() req: UserRequest,
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @Query() query: VolunteerPlanningQueryDto,
  ) {
    return this.assignmentsService.listVolunteerPlanning(req.user, volunteerId, query.status);
  }
}

