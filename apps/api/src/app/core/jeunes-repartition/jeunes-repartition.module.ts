import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group, Participant, Team, TeamParticipant } from '../entities';
import { JeunesRepartitionController } from './jeunes-repartition.controller';
import { JeunesRepartitionService } from './jeunes-repartition.service';

@Module({
  imports: [TypeOrmModule.forFeature([Participant, Team, TeamParticipant, Group])],
  controllers: [JeunesRepartitionController],
  providers: [JeunesRepartitionService],
  exports: [JeunesRepartitionService],
})
export class JeunesRepartitionModule {}
