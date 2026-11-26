import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  GatheringGroup,
  GatheringGroupManager,
  GatheringGroupTeam,
  GatheringGroupVolunteerTeam,
  GatheringRepartition,
  ProgramSequence,
  Team,
  VolunteerTeam,
} from '../entities';
import { GatheringGroupsController } from './gathering-groups.controller';
import { GatheringGroupsService } from './gathering-groups.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      GatheringRepartition,
      GatheringGroup,
      GatheringGroupTeam,
      GatheringGroupVolunteerTeam,
      GatheringGroupManager,
      Team,
      ProgramSequence,
      VolunteerTeam,
    ]),
  ],
  controllers: [GatheringGroupsController],
  providers: [GatheringGroupsService],
  exports: [GatheringGroupsService],
})
export class GatheringGroupsModule {}
