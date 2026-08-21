import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Volunteer, VolunteerSkill, VolunteerTag } from '../entities';
import { VolunteerTeamMembership } from '../entities/volunteer-team-membership.entity';
import { VolunteerSkillsController } from './volunteer-skills.controller';
import { VolunteerSkillsService } from './volunteer-skills.service';

@Module({
  imports: [TypeOrmModule.forFeature([VolunteerSkill, VolunteerTag, Volunteer, VolunteerTeamMembership]), AuthModule],
  controllers: [VolunteerSkillsController],
  providers: [VolunteerSkillsService],
  exports: [VolunteerSkillsService],
})
export class VolunteerSkillsModule {}
