import { Body, Controller, Delete, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import {
  AccessLevelRequired,
  AccessModule,
  AccessScope,
  AccessScopeInfo,
  GroupScopeAware,
} from '../auth/access-module.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeamParticipantsService } from './team-participants.service';
import { AddTeamParticipantDto } from './team-participants.types';

@ApiTags('TeamParticipants')
@UseGuards(RoleGuard)
@AccessModule('GATHERING_TEAMS')
@GroupScopeAware()
@Controller('teams')
export class TeamParticipantsController {
  constructor(private readonly teamParticipantsService: TeamParticipantsService) {}

  @ApiOperation({ summary: 'Ajouter un participant a une equipe (controle maxSize)' })
  @AccessLevelRequired('EDIT')
  @Post(':id/participants')
  addParticipant(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddTeamParticipantDto,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.teamParticipantsService.addParticipant(id, dto, scope);
  }

  @ApiOperation({ summary: 'Retirer un participant d une equipe' })
  @AccessLevelRequired('EDIT')
  @Delete(':id/participants/:participantId')
  async removeParticipant(
    @Param('id', ParseIntPipe) id: number,
    @Param('participantId', ParseIntPipe) participantId: number,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    await this.teamParticipantsService.removeParticipant(id, participantId, scope);
    return { deleted: true };
  }
}
