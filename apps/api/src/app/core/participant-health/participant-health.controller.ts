import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { ParticipantHealthService } from './participant-health.service';
import { UpdateParticipantHealthDto } from './participant-health.types';

@Controller('participants')
export class ParticipantHealthController {
  constructor(private readonly participantHealthService: ParticipantHealthService) {}

  @UseGuards(AuthTokenGuard, RoleGuard)
  @Roles('ADMIN', 'HEALTH')
  @Get(':id/health')
  getHealth(@Param('id', ParseIntPipe) id: number) {
    return this.participantHealthService.getByParticipantId(id);
  }

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

