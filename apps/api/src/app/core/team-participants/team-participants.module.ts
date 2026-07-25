import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Participant, Team, TeamParticipant } from '../entities';
import { TeamParticipantsController } from './team-participants.controller';
import { TeamParticipantsService } from './team-participants.service';

@Module({
  imports: [TypeOrmModule.forFeature([Team, Participant, TeamParticipant])],
  controllers: [TeamParticipantsController],
  providers: [TeamParticipantsService],
})
export class TeamParticipantsModule {}

