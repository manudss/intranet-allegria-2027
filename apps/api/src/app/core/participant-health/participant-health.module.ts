import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Participant, ParticipantHealth, User } from '../entities';
import { AuthModule } from '../auth/auth.module';
import { ParticipantHealthController } from './participant-health.controller';
import { ParticipantHealthService } from './participant-health.service';

@Module({
  imports: [TypeOrmModule.forFeature([ParticipantHealth, Participant, User]), AuthModule],
  controllers: [ParticipantHealthController],
  providers: [ParticipantHealthService],
})
export class ParticipantHealthModule {}
