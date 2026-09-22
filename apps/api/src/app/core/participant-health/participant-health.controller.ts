import { Body, Controller, Get, Param, ParseIntPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { ParticipantHealthService } from './participant-health.service';
import { UpdateParticipantHealthDto } from './participant-health.types';

@ApiTags('ParticipantHealth')
@Controller('participants')
export class ParticipantHealthController {
  constructor(private readonly participantHealthService: ParticipantHealthService) {}

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Lire les donnees de sante d un participant (roles ADMIN|HEALTH)' })
  @UseGuards(AuthTokenGuard, RoleGuard)
  @Roles('ADMIN', 'HEALTH')
  @Get(':id/health')
  getHealth(@Param('id', ParseIntPipe) id: number) {
    return this.participantHealthService.getByParticipantId(id);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Mettre a jour les donnees de sante (roles ADMIN|HEALTH)' })
  @UseGuards(AuthTokenGuard, RoleGuard)
  @Roles('ADMIN', 'HEALTH')
  @Patch(':id/health')
  updateHealth(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateParticipantHealthDto,
    @Req() request: { user: { id: number } },
  ) {
    return this.participantHealthService.upsertByParticipantId(id, dto, request.user.id);
  }
}
