import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Volunteer, VolunteerTeam, VolunteerTeamMembership, VolunteerTeamType } from '../entities';
import { VolunteerTeamsController } from './volunteer-teams.controller';
import { VolunteerTeamsService } from './volunteer-teams.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VolunteerTeam,
      VolunteerTeamMembership,
      Volunteer,
      VolunteerTeamType,
    ]),
    AuthModule,
  ],
  controllers: [VolunteerTeamsController],
  providers: [VolunteerTeamsService],
  exports: [VolunteerTeamsService],
})
export class VolunteerTeamsModule {}
