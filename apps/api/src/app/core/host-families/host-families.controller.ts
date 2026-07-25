import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { HostFamiliesService } from './host-families.service';
import { CreateHostFamilyDto, UpdateHostFamilyDto } from './host-families.types';

@Controller('host-families')
export class HostFamiliesController {
  constructor(private readonly hostFamiliesService: HostFamiliesService) {}

  @Post()
  create(@Body() dto: CreateHostFamilyDto) {
    return this.hostFamiliesService.create(dto);
  }

  @Get()
  findAll() {
    return this.hostFamiliesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.hostFamiliesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHostFamilyDto) {
    return this.hostFamiliesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.hostFamiliesService.remove(id);
    return { deleted: true };
  }
}

