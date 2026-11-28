import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Place, PlaceRoom, Volunteer, VolunteerTeam } from '../entities';
import { PlaceOptionsController, PlacesController } from './places.controller';
import { GeocodingService } from './geocoding.service';
import { PlacesService } from './places.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Place, PlaceRoom, Volunteer, VolunteerTeam])],
  controllers: [PlacesController, PlaceOptionsController],
  providers: [PlacesService, GeocodingService],
  exports: [PlacesService],
})
export class PlacesModule {}
