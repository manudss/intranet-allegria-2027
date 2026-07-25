import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto, UpdateGroupDto } from './groups.types';

@ApiTags('Groups')
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @ApiOperation({ summary: 'Creer un groupe diocesain' })
  @Post()
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @ApiOperation({ summary: 'Lister les groupes' })
  @Get()
  findAll() {
    return this.groupsService.findAll();
  }

  @ApiOperation({ summary: 'Recuperer un groupe par id' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.groupsService.findOne(id);
  }

  @ApiOperation({ summary: 'Mettre a jour un groupe' })
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer un groupe' })
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.groupsService.remove(id);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Lister les participants d un groupe' })
  @Get(':id/participants')
  getParticipants(@Param('id', ParseIntPipe) id: number) {
    return this.groupsService.getParticipants(id);
  }

  @ApiOperation({ summary: 'Lister les equipes d un groupe' })
  @Get(':id/teams')
  getTeams(@Param('id', ParseIntPipe) id: number) {
    return this.groupsService.getTeams(id);
  }
}


