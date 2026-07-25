import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HostFamily } from '../entities';
import { HostFamiliesController } from './host-families.controller';
import { HostFamiliesService } from './host-families.service';

@Module({
  imports: [TypeOrmModule.forFeature([HostFamily])],
  controllers: [HostFamiliesController],
  providers: [HostFamiliesService],
  exports: [HostFamiliesService],
})
export class HostFamiliesModule {}

