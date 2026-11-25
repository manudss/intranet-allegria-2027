import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AccessModule,
  AccessScope,
  AccessScopeInfo,
  GroupScopeAware,
} from '../auth/access-module.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto, UpdateTeamDto } from './teams.types';

@ApiTags('Teams')
@UseGuards(RoleGuard)
@AccessModule('GATHERING_TEAMS')
@GroupScopeAware()
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @ApiOperation({ summary: 'Creer une equipe' })
  @Post()
  create(@Body() dto: CreateTeamDto, @AccessScope() scope: AccessScopeInfo) {
    return this.teamsService.create(dto, scope);
  }

  @ApiOperation({ summary: 'Lister les equipes' })
  @Get()
  findAll(@AccessScope() scope: AccessScopeInfo) {
    return this.teamsService.findAll(scope);
  }

  @ApiOperation({ summary: 'Recuperer une equipe par id' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    return this.teamsService.findOne(id, scope);
  }

  @ApiOperation({ summary: 'Mettre a jour une equipe' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeamDto,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.teamsService.update(id, dto, scope);
  }

  @ApiOperation({ summary: 'Supprimer une equipe' })
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    await this.teamsService.remove(id, scope);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Lister les participants d une equipe' })
  @Get(':id/participants')
  getParticipants(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    return this.teamsService.getParticipants(id, scope);
  }
}
