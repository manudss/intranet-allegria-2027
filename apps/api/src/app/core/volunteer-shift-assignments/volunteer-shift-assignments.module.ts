import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  Volunteer,
  VolunteerShift,
  VolunteerShiftAssignment,
  VolunteerTeamMembership,
} from '../entities';
import { VolunteerShiftAssignmentsController } from './volunteer-shift-assignments.controller';
import { VolunteerShiftAssignmentsService } from './volunteer-shift-assignments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VolunteerShiftAssignment,
      VolunteerShift,
      Volunteer,
      VolunteerTeamMembership,
    ]),
    AuthModule,
  ],
  controllers: [VolunteerShiftAssignmentsController],
  providers: [VolunteerShiftAssignmentsService],
  exports: [VolunteerShiftAssignmentsService],
})
export class VolunteerShiftAssignmentsModule {}


