import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HostFamily, Participant, ParticipantHostFamilyAssignment } from '../entities';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { HostFamilyAssignmentsController } from './host-family-assignments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ParticipantHostFamilyAssignment, Participant, HostFamily])],
  controllers: [AssignmentsController, HostFamilyAssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
