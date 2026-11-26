import { RoleGuard } from '../auth/role.guard';
import {
  AccessModule,
  AccessScope,
  AccessScopeInfo,
  GroupScopeAware,
} from '../auth/access-module.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ParticipantsService } from './participants.service';
import {
  CreateParticipantDto,
  SearchParticipantsQuery,
  UpdateParticipantDto,
} from './participants.types';

@ApiTags('Participants')
@UseGuards(RoleGuard)
@AccessModule('PARTICIPANTS')
@GroupScopeAware()
@Controller('participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Rechercher des participants disponibles' })
  search(@Query() query: SearchParticipantsQuery, @AccessScope() scope: AccessScopeInfo) {
    return this.participantsService.search(query, scope);
  }

  @ApiOperation({ summary: 'Creer un participant' })
  @Post()
  create(@Body() dto: CreateParticipantDto, @AccessScope() scope: AccessScopeInfo) {
    return this.participantsService.create(dto, scope);
  }

  @ApiOperation({ summary: 'Lister les participants (filtres optionnels)' })
  @ApiQuery({ name: 'groupId', required: false, type: Number })
  @ApiQuery({ name: 'diocese', required: false, type: String })
  @Get()
  findAll(
    @AccessScope() scope: AccessScopeInfo,
    @Query('groupId') groupId?: string,
    @Query('diocese') diocese?: string,
  ) {
    return this.participantsService.findAll(groupId ? Number(groupId) : undefined, diocese, scope);
  }

  @ApiOperation({ summary: 'Recuperer un participant par id' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    return this.participantsService.findOne(id, scope);
  }

  @ApiOperation({ summary: 'Mettre a jour un participant' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateParticipantDto,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.participantsService.update(id, dto, scope);
  }

  @ApiOperation({ summary: 'Supprimer un participant' })
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    await this.participantsService.remove(id, scope);
    return { deleted: true };
  }
}
