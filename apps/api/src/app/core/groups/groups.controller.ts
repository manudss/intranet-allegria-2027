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
import { GroupsService } from './groups.service';
import { CreateGroupDto, UpdateGroupDto } from './groups.types';

@ApiTags('Groups')
@UseGuards(RoleGuard)
@AccessModule('PARTICIPANTS')
@GroupScopeAware()
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @ApiOperation({ summary: 'Creer un groupe diocesain' })
  @Post()
  create(@Body() dto: CreateGroupDto, @AccessScope() scope: AccessScopeInfo) {
    return this.groupsService.create(dto, scope);
  }

  @ApiOperation({ summary: 'Lister les groupes' })
  @Get()
  findAll(@AccessScope() scope: AccessScopeInfo) {
    return this.groupsService.findAll(scope);
  }

  @ApiOperation({ summary: 'Recuperer un groupe par id' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    return this.groupsService.findOne(id, scope);
  }

  @ApiOperation({ summary: 'Mettre a jour un groupe' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGroupDto,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.groupsService.update(id, dto, scope);
  }

  @ApiOperation({ summary: 'Supprimer un groupe' })
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    await this.groupsService.remove(id, scope);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Lister les participants d un groupe' })
  @Get(':id/participants')
  getParticipants(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    return this.groupsService.getParticipants(id, scope);
  }

  @ApiOperation({ summary: 'Lister les equipes d un groupe' })
  @Get(':id/teams')
  getTeams(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    return this.groupsService.getTeams(id, scope);
  }
}
