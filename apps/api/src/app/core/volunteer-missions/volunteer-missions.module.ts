import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  Volunteer,
  VolunteerMission,
  VolunteerShift,
  VolunteerTeam,
  VolunteerTeamMembership,
  MissionStatusLog,
  ShiftStatusLog,
} from '../entities';
import { VolunteerMissionsController } from './volunteer-missions.controller';
import { VolunteerMissionsService } from './volunteer-missions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VolunteerMission,
      VolunteerShift,
      VolunteerTeam,
      Volunteer,
      VolunteerTeamMembership,
      MissionStatusLog,
      ShiftStatusLog,
    ]),
    AuthModule,
  ],
  controllers: [VolunteerMissionsController],
  providers: [VolunteerMissionsService],
  exports: [VolunteerMissionsService],
})
export class VolunteerMissionsModule {}
