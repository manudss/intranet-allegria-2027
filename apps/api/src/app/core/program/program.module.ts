import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProgramChangeLog, ProgramSequence } from '../entities';
import { ProgramController } from './program.controller';
import { ProgramRecalcService } from './program-recalc.service';
import { ProgramService } from './program.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProgramSequence, ProgramChangeLog]), AuthModule],
  controllers: [ProgramController],
  providers: [ProgramService, ProgramRecalcService],
  exports: [ProgramRecalcService],
})
export class ProgramModule {}
