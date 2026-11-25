import { Body, Controller, Delete, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { AccessLevelRequired, AccessModule } from '../auth/access-module.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeamParticipantsService } from './team-participants.service';
import { AddTeamParticipantDto } from './team-participants.types';

@ApiTags('TeamParticipants')
@UseGuards(RoleGuard)
@AccessModule('GATHERING_TEAMS')
@Controller('teams')
export class TeamParticipantsController {
  constructor(private readonly teamParticipantsService: TeamParticipantsService) {}

  @ApiOperation({ summary: 'Ajouter un participant a une equipe (controle maxSize)' })
  @AccessLevelRequired('EDIT')
  @Post(':id/participants')
  addParticipant(@Param('id', ParseIntPipe) id: number, @Body() dto: AddTeamParticipantDto) {
    return this.teamParticipantsService.addParticipant(id, dto);
  }

  @ApiOperation({ summary: 'Retirer un participant d une equipe' })
  @AccessLevelRequired('EDIT')
  @Delete(':id/participants/:participantId')
  async removeParticipant(
    @Param('id', ParseIntPipe) id: number,
    @Param('participantId', ParseIntPipe) participantId: number,
  ) {
    await this.teamParticipantsService.removeParticipant(id, participantId);
    return { deleted: true };
  }
}
