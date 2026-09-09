import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  Volunteer,
  VolunteerMission,
  VolunteerShift,
  VolunteerShiftAssignment,
  VolunteerTeam,
  VolunteerTeamMembership,
} from '../entities';
import { OperationalDashboardController } from './operational-dashboard.controller';
import { OperationalDashboardService } from './operational-dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VolunteerMission,
      VolunteerShift,
      VolunteerShiftAssignment,
      VolunteerTeam,
      Volunteer,
      VolunteerTeamMembership,
    ]),
    AuthModule,
  ],
  controllers: [OperationalDashboardController],
  providers: [OperationalDashboardService],
})
export class OperationalDashboardModule {}

