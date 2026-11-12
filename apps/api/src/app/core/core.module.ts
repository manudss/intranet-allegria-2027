import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { GroupsModule } from './groups/groups.module';
import { HostFamiliesModule } from './host-families/host-families.module';
import { HostingPlacementModule } from './hosting-placement/hosting-placement.module';
import { ParticipantHealthModule } from './participant-health/participant-health.module';
import { ParticipantsModule } from './participants/participants.module';
import { VolunteerSkillsModule } from './volunteer-skills/volunteer-skills.module';
import { VolunteerTeamsModule } from './volunteer-teams/volunteer-teams.module';
import { TeamParticipantsModule } from './team-participants/team-participants.module';
import { TeamBenevolesModule } from './team-benevoles/team-benevoles.module';
import { TeamsModule } from './teams/teams.module';
import { VolunteersModule } from './volunteers/volunteers.module';
import { VolunteerMissionsModule } from './volunteer-missions/volunteer-missions.module';
import { VolunteerShiftAssignmentsModule } from './volunteer-shift-assignments/volunteer-shift-assignments.module';
import { VolunteerAuditLogsModule } from './volunteer-audit-logs/volunteer-audit-logs.module';
import { OperationalDashboardModule } from './operational-dashboard/operational-dashboard.module';
import { PublicRegistrationsModule } from './public-registrations/public-registrations.module';
import { ProgramModule } from './program/program.module';
import { MySpaceModule } from './my-space/my-space.module';
import { VolunteerHostingModule } from './volunteer-hosting/volunteer-hosting.module';

@Module({
  imports: [
    AuthModule,
    GroupsModule,
    ParticipantsModule,
    TeamsModule,
    TeamParticipantsModule,
    TeamBenevolesModule,
    VolunteersModule,
    VolunteerTeamsModule,
    VolunteerMissionsModule,
    VolunteerShiftAssignmentsModule,
    VolunteerAuditLogsModule,
    VolunteerSkillsModule,
    HostFamiliesModule,
    AssignmentsModule,
    HostingPlacementModule,
    ParticipantHealthModule,
    OperationalDashboardModule,
    PublicRegistrationsModule,
    ProgramModule,
    MySpaceModule,
    VolunteerHostingModule,
  ],
})
export class CoreModule {}
