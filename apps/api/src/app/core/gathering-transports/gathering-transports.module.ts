import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  GatheringCar,
  GatheringCarAssignment,
  GatheringCarPerson,
  GatheringCarStop,
  HostFamily,
  HostingGroup,
  Participant,
  ParticipantHostFamilyAssignment,
} from '../entities';
import { GatheringTransportsController } from './gathering-transports.controller';
import { GatheringTransportsService } from './gathering-transports.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      GatheringCar,
      GatheringCarStop,
      GatheringCarAssignment,
      GatheringCarPerson,
      HostingGroup,
      HostFamily,
      ParticipantHostFamilyAssignment,
      Participant,
    ]),
  ],
  controllers: [GatheringTransportsController],
  providers: [GatheringTransportsService],
  exports: [GatheringTransportsService],
})
export class GatheringTransportsModule {}
