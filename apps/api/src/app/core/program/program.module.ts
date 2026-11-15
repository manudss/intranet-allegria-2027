import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProgramChangeLog, ProgramPublicExport, ProgramSequence } from '../entities';
import { ProgramController } from './program.controller';
import { PublicProgramController } from './public-program.controller';
import { ProgramRecalcService } from './program-recalc.service';
import { ProgramService } from './program.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProgramSequence, ProgramChangeLog, ProgramPublicExport]), AuthModule],
  controllers: [ProgramController, PublicProgramController],
  providers: [ProgramService, ProgramRecalcService],
  exports: [ProgramRecalcService],
})
export class ProgramModule {}
