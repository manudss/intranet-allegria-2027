import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  Participant,
  Team,
  TeamParticipant,
  Volunteer,
  VolunteerTeamLodging,
} from '../entities';
import { TeamBenevolesController } from './team-benevoles.controller';
import { TeamBenevolesService } from './team-benevoles.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Team, Volunteer, Participant, TeamParticipant, VolunteerTeamLodging]),
  ],
  controllers: [TeamBenevolesController],
  providers: [TeamBenevolesService],
})
export class TeamBenevolesModule {}
