import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VolunteerShiftAssignmentsModule } from '../volunteer-shift-assignments/volunteer-shift-assignments.module';
import { VolunteerTeamsModule } from '../volunteer-teams/volunteer-teams.module';
import { VolunteersModule } from '../volunteers/volunteers.module';
import { MySpaceController } from './my-space.controller';

@Module({
  imports: [
    AuthModule,
    VolunteersModule,
    VolunteerShiftAssignmentsModule,
    VolunteerTeamsModule,
  ],
  controllers: [MySpaceController],
})
export class MySpaceModule {}
