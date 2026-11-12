import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HostFamily, Volunteer, VolunteerHostingAssignment } from '../entities';
import { VolunteerHostingController } from './volunteer-hosting.controller';
import { VolunteerHostingService } from './volunteer-hosting.service';

@Module({
  imports: [TypeOrmModule.forFeature([VolunteerHostingAssignment, Volunteer, HostFamily])],
  controllers: [VolunteerHostingController],
  providers: [VolunteerHostingService],
  exports: [VolunteerHostingService],
})
export class VolunteerHostingModule {}
