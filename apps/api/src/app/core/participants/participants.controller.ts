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
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ParticipantsService } from './participants.service';
import {
  CreateParticipantDto,
  SearchParticipantsQuery,
  UpdateParticipantDto,
} from './participants.types';

@ApiTags('Participants')
@Controller('participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Rechercher des participants disponibles' })
  search(@Query() query: SearchParticipantsQuery) {
    return this.participantsService.search(query);
  }

  @ApiOperation({ summary: 'Creer un participant' })
  @Post()
  create(@Body() dto: CreateParticipantDto) {
    return this.participantsService.create(dto);
  }

  @ApiOperation({ summary: 'Lister les participants (filtres optionnels)' })
  @ApiQuery({ name: 'groupId', required: false, type: Number })
  @ApiQuery({ name: 'diocese', required: false, type: String })
  @Get()
  findAll(@Query('groupId') groupId?: string, @Query('diocese') diocese?: string) {
    return this.participantsService.findAll(groupId ? Number(groupId) : undefined, diocese);
  }

  @ApiOperation({ summary: 'Recuperer un participant par id' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.participantsService.findOne(id);
  }

  @ApiOperation({ summary: 'Mettre a jour un participant' })
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateParticipantDto) {
    return this.participantsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer un participant' })
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.participantsService.remove(id);
    return { deleted: true };
  }
}
