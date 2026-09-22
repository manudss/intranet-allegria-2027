import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto, UpdateTeamDto } from './teams.types';

@ApiTags('Teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @ApiOperation({ summary: 'Creer une equipe' })
  @Post()
  create(@Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto);
  }

  @ApiOperation({ summary: 'Lister les equipes' })
  @Get()
  findAll() {
    return this.teamsService.findAll();
  }

  @ApiOperation({ summary: 'Recuperer une equipe par id' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.teamsService.findOne(id);
  }

  @ApiOperation({ summary: 'Mettre a jour une equipe' })
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer une equipe' })
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.teamsService.remove(id);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Lister les participants d une equipe' })
  @Get(':id/participants')
  getParticipants(@Param('id', ParseIntPipe) id: number) {
    return this.teamsService.getParticipants(id);
  }
}
