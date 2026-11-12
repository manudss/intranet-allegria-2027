import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Group, Participant, Team, TeamParticipant } from '../entities';
import { JeunesRepartitionController } from './jeunes-repartition.controller';
import { JeunesRepartitionService } from './jeunes-repartition.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Participant, Team, TeamParticipant, Group])],
  controllers: [JeunesRepartitionController],
  providers: [JeunesRepartitionService],
  exports: [JeunesRepartitionService],
})
export class JeunesRepartitionModule {}
