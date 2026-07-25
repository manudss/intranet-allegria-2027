import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ParticipantsService } from './participants.service';
import { CreateParticipantDto, UpdateParticipantDto } from './participants.types';

@Controller('participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Post()
  create(@Body() dto: CreateParticipantDto) {
    return this.participantsService.create(dto);
  }

  @Get()
  findAll(
    @Query('groupId') groupId?: string,
    @Query('diocese') diocese?: string,
  ) {
    return this.participantsService.findAll(groupId ? Number(groupId) : undefined, diocese);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.participantsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateParticipantDto) {
    return this.participantsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.participantsService.remove(id);
    return { deleted: true };
  }
}

