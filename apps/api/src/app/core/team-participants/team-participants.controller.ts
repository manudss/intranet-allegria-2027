import { Body, Controller, Delete, Param, ParseIntPipe, Post } from '@nestjs/common';
import { TeamParticipantsService } from './team-participants.service';
import { AddTeamParticipantDto } from './team-participants.types';

@Controller('teams')
export class TeamParticipantsController {
  constructor(private readonly teamParticipantsService: TeamParticipantsService) {}

  @Post(':id/participants')
  addParticipant(@Param('id', ParseIntPipe) id: number, @Body() dto: AddTeamParticipantDto) {
    return this.teamParticipantsService.addParticipant(id, dto);
  }

  @Delete(':id/participants/:participantId')
  async removeParticipant(
    @Param('id', ParseIntPipe) id: number,
    @Param('participantId', ParseIntPipe) participantId: number,
  ) {
    await this.teamParticipantsService.removeParticipant(id, participantId);
    return { deleted: true };
  }
}

