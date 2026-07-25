import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Volunteer } from '../entities';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Volunteer, User])],
  controllers: [VolunteersController],
  providers: [VolunteersService],
  exports: [VolunteersService],
})
export class VolunteersModule {}

