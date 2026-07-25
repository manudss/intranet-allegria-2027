import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CreateVolunteerDto, UpdateVolunteerDto } from './volunteers.types';
import { VolunteersService } from './volunteers.service';

@Controller('volunteers')
export class VolunteersController {
  constructor(private readonly volunteersService: VolunteersService) {}

  @Post()
  create(@Body() dto: CreateVolunteerDto) {
    return this.volunteersService.create(dto);
  }

  @Get()
  findAll() {
    return this.volunteersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.volunteersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVolunteerDto) {
    return this.volunteersService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.volunteersService.remove(id);
    return { deleted: true };
  }
}

