import { Body, Controller, Get, Param, ParseIntPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import {
  AccessModule,
  AccessScope,
  AccessScopeInfo,
  GroupScopeAware,
} from '../auth/access-module.decorator';
import { AccessRightsService } from '../access-rights/access-rights.service';
import { ParticipantHealthService } from './participant-health.service';
import { UpdateParticipantHealthDto } from './participant-health.types';

@ApiTags('ParticipantHealth')
@AccessModule('HEALTH')
@GroupScopeAware()
@Controller('participants')
export class ParticipantHealthController {
  constructor(
    private readonly participantHealthService: ParticipantHealthService,
    private readonly accessRights: AccessRightsService,
  ) {}

  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Lire les donnees de sante d un participant (module Santé de la matrice de droits)',
  })
  @UseGuards(AuthTokenGuard, RoleGuard)
  @Get(':id/health')
  async getHealth(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    await this.accessRights.assertParticipantInScope(scope, id);
    return this.participantHealthService.getByParticipantId(id);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Mettre a jour les donnees de sante (module Santé de la matrice de droits)',
  })
  @UseGuards(AuthTokenGuard, RoleGuard)
  @Patch(':id/health')
  async updateHealth(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateParticipantHealthDto,
    @Req() request: { user: { id: number } },
    @AccessScope() scope: AccessScopeInfo,
  ) {
    await this.accessRights.assertParticipantInScope(scope, id);
    return this.participantHealthService.upsertByParticipantId(id, dto, request.user.id);
  }
}
