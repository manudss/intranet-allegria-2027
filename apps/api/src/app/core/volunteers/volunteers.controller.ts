import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateVolunteerDto, UpdateVolunteerDto } from './volunteers.types';
import { VolunteersService } from './volunteers.service';

@ApiTags('Volunteers')
@Controller('volunteers')
export class VolunteersController {
  constructor(private readonly volunteersService: VolunteersService) {}

  @ApiOperation({ summary: 'Creer un benevole' })
  @Post()
  create(@Body() dto: CreateVolunteerDto) {
    return this.volunteersService.create(dto);
  }

  @ApiOperation({ summary: 'Lister les benevoles' })
  @Get()
  findAll() {
    return this.volunteersService.findAll();
  }

  @ApiOperation({ summary: 'Recuperer un benevole par id' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.volunteersService.findOne(id);
  }

  @ApiOperation({ summary: 'Mettre a jour un benevole' })
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVolunteerDto) {
    return this.volunteersService.update(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer un benevole' })
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.volunteersService.remove(id);
    return { deleted: true };
  }
}


