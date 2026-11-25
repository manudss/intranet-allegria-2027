import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { AccessModule } from '../auth/access-module.decorator';
import { VolunteerAuditLogsService } from './volunteer-audit-logs.service';
import { SearchVolunteerAuditLogsQueryDto } from './volunteer-audit-logs.types';

@ApiTags('VolunteerAuditLogs')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller('volunteer-audit-logs')
export class VolunteerAuditLogsController {
  constructor(private readonly volunteerAuditLogsService: VolunteerAuditLogsService) {}

  @ApiOperation({ summary: 'Lister le journal des modifications bénévoles' })
  @AccessModule('AUDIT')
  @Get()
  search(@Query() query: SearchVolunteerAuditLogsQueryDto) {
    return this.volunteerAuditLogsService.search(query);
  }
}
