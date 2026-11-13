import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  Group,
  HostingGroup,
  Participant,
  Team,
  TeamParticipant,
  Volunteer,
  VolunteerTag,
  VolunteerTeam,
  VolunteerTeamLodging,
  VolunteerTeamMembership,
} from '../entities';
import { TeamBenevolesController } from './team-benevoles.controller';
import { TeamBenevolesService } from './team-benevoles.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Team,
      Volunteer,
      Participant,
      TeamParticipant,
      VolunteerTeamLodging,
      Group,
      HostingGroup,
      VolunteerTeam,
      VolunteerTeamMembership,
      VolunteerTag,
    ]),
  ],
  controllers: [TeamBenevolesController],
  providers: [TeamBenevolesService],
  exports: [TeamBenevolesService],
})
export class TeamBenevolesModule {}
