import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HostFamiliesService } from './host-families.service';
import { CreateHostFamilyDto, UpdateHostFamilyDto } from './host-families.types';

@ApiTags('HostFamilies')
@Controller('host-families')
export class HostFamiliesController {
  constructor(private readonly hostFamiliesService: HostFamiliesService) {}

  @ApiOperation({ summary: 'Creer une famille d accueil' })
  @Post()
  create(@Body() dto: CreateHostFamilyDto) {
    return this.hostFamiliesService.create(dto);
  }

  @ApiOperation({ summary: 'Lister les familles d accueil' })
  @Get()
  findAll() {
    return this.hostFamiliesService.findAll();
  }

  @ApiOperation({ summary: 'Recuperer une famille d accueil par id' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.hostFamiliesService.findOne(id);
  }

  @ApiOperation({ summary: 'Mettre a jour une famille d accueil' })
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHostFamilyDto) {
    return this.hostFamiliesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer une famille d accueil' })
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.hostFamiliesService.remove(id);
    return { deleted: true };
  }
}
