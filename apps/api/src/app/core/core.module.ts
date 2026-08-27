import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { GroupsModule } from './groups/groups.module';
import { HostFamiliesModule } from './host-families/host-families.module';
import { ParticipantHealthModule } from './participant-health/participant-health.module';
import { ParticipantsModule } from './participants/participants.module';
import { VolunteerSkillsModule } from './volunteer-skills/volunteer-skills.module';
import { VolunteerTeamsModule } from './volunteer-teams/volunteer-teams.module';
import { TeamParticipantsModule } from './team-participants/team-participants.module';
import { TeamsModule } from './teams/teams.module';
import { VolunteersModule } from './volunteers/volunteers.module';
import { VolunteerMissionsModule } from './volunteer-missions/volunteer-missions.module';
import { VolunteerShiftAssignmentsModule } from './volunteer-shift-assignments/volunteer-shift-assignments.module';

@Module({
  imports: [
    AuthModule,
    GroupsModule,
    ParticipantsModule,
    TeamsModule,
    TeamParticipantsModule,
    VolunteersModule,
    VolunteerTeamsModule,
    VolunteerMissionsModule,
    VolunteerShiftAssignmentsModule,
    VolunteerSkillsModule,
    HostFamiliesModule,
    AssignmentsModule,
    ParticipantHealthModule,
  ],
})
export class CoreModule {}
