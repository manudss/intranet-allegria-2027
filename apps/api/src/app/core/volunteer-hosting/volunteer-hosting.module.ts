import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { HostFamily, Volunteer, VolunteerHostingAssignment } from '../entities';
import { VolunteerHostingController } from './volunteer-hosting.controller';
import { VolunteerHostingService } from './volunteer-hosting.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([VolunteerHostingAssignment, Volunteer, HostFamily])],
  controllers: [VolunteerHostingController],
  providers: [VolunteerHostingService],
  exports: [VolunteerHostingService],
})
export class VolunteerHostingModule {}
