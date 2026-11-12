import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Team, Volunteer, VolunteerTeamLodging } from '../entities';
import { VolunteerHostingController } from './volunteer-hosting.controller';
import { VolunteerHostingService } from './volunteer-hosting.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([VolunteerTeamLodging, Volunteer, Team])],
  controllers: [VolunteerHostingController],
  providers: [VolunteerHostingService],
  exports: [VolunteerHostingService],
})
export class VolunteerHostingModule {}
