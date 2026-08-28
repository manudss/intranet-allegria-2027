import {
  Body,
  Controller,
  Delete,
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
  ChangeVolunteerMissionStatusDto,
  ChangeVolunteerShiftStatusDto,
  CreateVolunteerMissionDto,
  CreateVolunteerShiftDto,
  DayViewQueryDto,
  FindVolunteerMissionsQueryDto,
  UpdateVolunteerMissionDto,
  UpdateVolunteerShiftDto,
} from './volunteer-missions.types';
import { VolunteerMissionsService } from './volunteer-missions.service';
import { VolunteerShiftStatus, VolunteerMissionStatus } from '../entities';

const READ_ROLES = ['ADMIN', 'COORDINATOR', 'HEALTH', 'ANIMATOR', 'LOGISTICS', 'VOLUNTEERS', 'VIEWER'];
const WRITE_ROLES = ['ADMIN', 'COORDINATOR', 'HEALTH', 'ANIMATOR', 'LOGISTICS', 'VOLUNTEERS'];

type UserRequest = { user: { id: number; email: string; roles: string[] } };

@ApiTags('VolunteerMissions')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller('volunteer-missions')
export class VolunteerMissionsController {
  constructor(private readonly volunteerMissionsService: VolunteerMissionsService) {}

  @ApiOperation({ summary: 'Creer une mission benevole' })
  @Roles(...WRITE_ROLES)
  @Post()
  create(@Req() req: UserRequest, @Body() dto: CreateVolunteerMissionDto) {
    return this.volunteerMissionsService.create(req.user, dto);
  }

  @ApiOperation({ summary: 'Lister les missions benevoles' })
  @Roles(...READ_ROLES)
  @Get()
  findAll(@Req() req: UserRequest, @Query() query: FindVolunteerMissionsQueryDto) {
    return this.volunteerMissionsService.findAll(req.user, query);
  }

  @ApiOperation({ summary: 'Vue mobile jour J des shifts' })
  @Roles(...READ_ROLES)
  @Get('day-view')
  dayView(@Req() req: UserRequest, @Query() query: DayViewQueryDto) {
    return this.volunteerMissionsService.dayView(req.user, query);
  }

  @ApiOperation({ summary: 'Recuperer une mission benevole' })
  @Roles(...READ_ROLES)
  @Get(':id')
  findOne(@Req() req: UserRequest, @Param('id', ParseIntPipe) id: number) {
    return this.volunteerMissionsService.findOne(req.user, id);
  }

  @ApiOperation({ summary: 'Mettre a jour une mission benevole' })
  @Roles(...WRITE_ROLES)
  @Patch(':id')
  update(@Req() req: UserRequest, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVolunteerMissionDto) {
    return this.volunteerMissionsService.update(req.user, id, dto);
  }

  @ApiOperation({ summary: 'Changer le statut d une mission benevole' })
  @Roles(...WRITE_ROLES)
  @Patch(':id/status')
  changeStatus(
    @Req() req: UserRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeVolunteerMissionStatusDto,
  ) {
    return this.volunteerMissionsService.changeStatus(req.user, id, dto);
  }

  @ApiOperation({ summary: 'Supprimer une mission benevole' })
  @Roles(...WRITE_ROLES)
  @Delete(':id')
  async remove(@Req() req: UserRequest, @Param('id', ParseIntPipe) id: number) {
    await this.volunteerMissionsService.remove(req.user, id);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Lister les shifts d une mission' })
  @Roles(...READ_ROLES)
  @Get(':missionId/shifts')
  listShifts(@Req() req: UserRequest, @Param('missionId', ParseIntPipe) missionId: number) {
    return this.volunteerMissionsService.listShifts(req.user, missionId);
  }

  @ApiOperation({ summary: 'Creer un shift' })
  @Roles(...WRITE_ROLES)
  @Post(':missionId/shifts')
  createShift(
    @Req() req: UserRequest,
    @Param('missionId', ParseIntPipe) missionId: number,
    @Body() dto: CreateVolunteerShiftDto,
  ) {
    return this.volunteerMissionsService.createShift(req.user, missionId, dto);
  }

  @ApiOperation({ summary: 'Mettre a jour un shift' })
  @Roles(...WRITE_ROLES)
  @Patch(':missionId/shifts/:shiftId')
  updateShift(
    @Req() req: UserRequest,
    @Param('missionId', ParseIntPipe) missionId: number,
    @Param('shiftId', ParseIntPipe) shiftId: number,
    @Body() dto: UpdateVolunteerShiftDto,
  ) {
    return this.volunteerMissionsService.updateShift(req.user, missionId, shiftId, dto);
  }

  @ApiOperation({ summary: 'Changer le statut d un shift' })
  @Roles(...WRITE_ROLES)
  @Patch(':missionId/shifts/:shiftId/status')
  changeShiftStatus(
    @Req() req: UserRequest,
    @Param('missionId', ParseIntPipe) missionId: number,
    @Param('shiftId', ParseIntPipe) shiftId: number,
    @Body() dto: ChangeVolunteerShiftStatusDto,
  ) {
    return this.volunteerMissionsService.changeShiftStatus(req.user, missionId, shiftId, dto);
  }

  @ApiOperation({ summary: 'Supprimer un shift' })
  @Roles(...WRITE_ROLES)
  @Delete(':missionId/shifts/:shiftId')
  async removeShift(
    @Req() req: UserRequest,
    @Param('missionId', ParseIntPipe) missionId: number,
    @Param('shiftId', ParseIntPipe) shiftId: number,
  ) {
    await this.volunteerMissionsService.removeShift(req.user, missionId, shiftId);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Obtenir les compteurs de statuts des missions et shifts' })
  @Roles(...READ_ROLES)
  @Get('summary/counters')
  getStatusCounters(@Req() req: UserRequest) {
    return this.volunteerMissionsService.getStatusCounters(req.user);
  }

  @ApiOperation({ summary: 'Lister les shifts par statut' })
  @Roles(...READ_ROLES)
  @Get('shifts/by-status/:status')
  listShiftsByStatus(
    @Req() req: UserRequest,
    @Param('status') status: VolunteerShiftStatus,
    @Query('mandatory') mandatory?: string,
  ) {
    const isMandatory = mandatory === 'true' ? true : mandatory === 'false' ? false : undefined;
    return this.volunteerMissionsService.listShiftsByStatus(req.user, status, isMandatory);
  }

  @ApiOperation({ summary: 'Lister les missions par statut' })
  @Roles(...READ_ROLES)
  @Get('missions/by-status/:status')
  listMissionsByStatus(
    @Req() req: UserRequest,
    @Param('status') status: VolunteerMissionStatus,
    @Query('mandatory') mandatory?: string,
  ) {
    const isMandatory = mandatory === 'true' ? true : mandatory === 'false' ? false : undefined;
    return this.volunteerMissionsService.listMissionsByStatus(req.user, status, isMandatory);
  }
}



