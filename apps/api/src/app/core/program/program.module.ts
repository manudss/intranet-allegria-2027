import { ProgramMissionTimingService } from './program-mission-timing.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  EventPreparationTask,
  ProgramChangeLog,
  ProgramPublicExport,
  ProgramSequence,
  ProgramSequenceGroup,
} from '../entities';
import { ProgramController } from './program.controller';
import { PublicProgramController } from './public-program.controller';
import { ProgramRecalcService } from './program-recalc.service';
import { ProgramService } from './program.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProgramSequence,
      ProgramChangeLog,
      ProgramPublicExport,
      ProgramSequenceGroup,
      EventPreparationTask,
    ]),
    AuthModule,
  ],
  controllers: [ProgramController, PublicProgramController],
  providers: [ProgramService, ProgramRecalcService, ProgramMissionTimingService],
  exports: [ProgramRecalcService],
})
export class ProgramModule {}
