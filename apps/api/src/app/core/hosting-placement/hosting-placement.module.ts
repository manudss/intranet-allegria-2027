import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  HostFamily,
  HostingGroup,
  Participant,
  ParticipantHostFamilyAssignment,
  Team,
  TeamParticipant,
} from '../entities';
import { HostingPlacementController } from './hosting-placement.controller';
import { HostingPlacementService } from './hosting-placement.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      HostingGroup,
      Team,
      HostFamily,
      Participant,
      TeamParticipant,
      ParticipantHostFamilyAssignment,
    ]),
  ],
  controllers: [HostingPlacementController],
  providers: [HostingPlacementService],
})
export class HostingPlacementModule {}
