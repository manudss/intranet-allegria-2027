import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto, UpdateAssignmentDto } from './assignments.types';

@ApiTags('Assignments')
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @ApiOperation({ summary: 'Creer une affectation d hebergement' })
  @Post()
  create(@Body() dto: CreateAssignmentDto) {
    return this.assignmentsService.create(dto);
  }

  @ApiOperation({ summary: 'Lister les affectations d hebergement' })
  @Get()
  findAll() {
    return this.assignmentsService.findAll();
  }

  @ApiOperation({ summary: 'Recuperer une affectation par id' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.assignmentsService.findOne(id);
  }

  @ApiOperation({ summary: 'Mettre a jour une affectation' })
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAssignmentDto) {
    return this.assignmentsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer une affectation' })
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.assignmentsService.remove(id);
    return { deleted: true };
  }
}
