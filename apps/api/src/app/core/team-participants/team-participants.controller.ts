import { Body, Controller, Delete, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeamParticipantsService } from './team-participants.service';
import { AddTeamParticipantDto } from './team-participants.types';

@ApiTags('TeamParticipants')
@Controller('teams')
export class TeamParticipantsController {
  constructor(private readonly teamParticipantsService: TeamParticipantsService) {}

  @ApiOperation({ summary: 'Ajouter un participant a une equipe (controle maxSize)' })
  @Post(':id/participants')
  addParticipant(@Param('id', ParseIntPipe) id: number, @Body() dto: AddTeamParticipantDto) {
    return this.teamParticipantsService.addParticipant(id, dto);
  }

  @ApiOperation({ summary: 'Retirer un participant d une equipe' })
  @Delete(':id/participants/:participantId')
  async removeParticipant(
    @Param('id', ParseIntPipe) id: number,
    @Param('participantId', ParseIntPipe) participantId: number,
  ) {
    await this.teamParticipantsService.removeParticipant(id, participantId);
    return { deleted: true };
  }
}


