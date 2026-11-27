import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  DelegationTransport,
  Group,
  Participant,
  PersonNote,
  TransportAssignment,
  User,
  Volunteer,
} from '../entities';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';
import { PersonNotesController } from './person-notes.controller';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      DelegationTransport,
      TransportAssignment,
      PersonNote,
      Group,
      Participant,
      Volunteer,
      User,
    ]),
  ],
  controllers: [DelegationsController, PersonNotesController],
  providers: [DelegationsService],
  exports: [DelegationsService],
})
export class DelegationsModule {}
