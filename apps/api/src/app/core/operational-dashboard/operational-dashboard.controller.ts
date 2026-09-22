import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { OperationalDashboardService } from './operational-dashboard.service';
import {
  DashboardQueryDto,
  DashboardWhoDoesWhatQueryDto,
  OperationalExportKind,
  OperationalExportQueryDto,
} from './operational-dashboard.types';

const DASHBOARD_ROLES = ['ADMIN', 'COORDINATOR', 'HEALTH', 'ANIMATOR', 'LOGISTICS', 'VIEWER'];

type UserRequest = { user: { id: number; email: string; roles: string[] } };

@ApiTags('OperationalDashboard')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller('operational-dashboard')
export class OperationalDashboardController {
  constructor(private readonly service: OperationalDashboardService) {}

  @ApiOperation({ summary: 'Vue globale du jour J (missions, shifts, alertes)' })
  @Roles(...DASHBOARD_ROLES)
  @Get('global')
  getGlobalSummary(@Req() req: UserRequest, @Query() query: DashboardQueryDto) {
    return this.service.getGlobalSummary(req.user, query);
  }

  @ApiOperation({ summary: 'Vue par équipe opérationnelle' })
  @Roles(...DASHBOARD_ROLES)
  @Get('teams')
  getTeamsSummary(@Req() req: UserRequest, @Query() query: DashboardQueryDto) {
    return this.service.getTeamsSummary(req.user, query);
  }

  @ApiOperation({ summary: 'Vue par lieu' })
  @Roles(...DASHBOARD_ROLES)
  @Get('locations')
  getLocationsSummary(@Req() req: UserRequest, @Query() query: DashboardQueryDto) {
    return this.service.getLocationsSummary(req.user, query);
  }

  @ApiOperation({ summary: 'Qui fait quoi — recherche bénévoles paginée' })
  @Roles(...DASHBOARD_ROLES)
  @Get('who-does-what')
  getWhoDoesWhat(@Req() req: UserRequest, @Query() query: DashboardWhoDoesWhatQueryDto) {
    return this.service.getWhoDoesWhat(req.user, query);
  }

  @ApiOperation({ summary: 'Liste des tâches à faire (missions / shifts sans effectif confirmé)' })
  @Roles(...DASHBOARD_ROLES)
  @Get('todo')
  getTodoList(@Req() req: UserRequest, @Query() query: DashboardQueryDto) {
    return this.service.getTodoList(req.user, query);
  }

  @ApiOperation({ summary: 'Exports opérationnels bénévoles' })
  @Roles(...DASHBOARD_ROLES, 'VOLUNTEERS')
  @Get('exports/:kind')
  async exportOperationalData(
    @Req() req: UserRequest,
    @Param('kind') kind: OperationalExportKind,
    @Query() query: OperationalExportQueryDto,
    @Res() res: Response,
  ) {
    const file = await this.service.exportOperationalData(req.user, kind, query);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.body);
  }
}
