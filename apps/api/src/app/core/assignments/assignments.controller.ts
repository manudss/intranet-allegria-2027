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
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto, UpdateAssignmentDto } from './assignments.types';

@ApiTags('Assignments')
@UseGuards(RoleGuard)
@AccessModule('HOUSING')
@GroupScopeAware()
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @ApiOperation({ summary: 'Creer une affectation d hebergement' })
  @Post()
  create(@Body() dto: CreateAssignmentDto, @AccessScope() scope: AccessScopeInfo) {
    return this.assignmentsService.create(dto, scope);
  }

  @ApiOperation({ summary: 'Lister les affectations d hebergement' })
  @Get()
  findAll(@AccessScope() scope: AccessScopeInfo) {
    return this.assignmentsService.findAll(scope);
  }

  @ApiOperation({ summary: 'Recuperer une affectation par id' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    return this.assignmentsService.findOne(id, scope);
  }

  @ApiOperation({ summary: 'Mettre a jour une affectation' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssignmentDto,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.assignmentsService.update(id, dto, scope);
  }

  @ApiOperation({ summary: 'Supprimer une affectation' })
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    await this.assignmentsService.remove(id, scope);
    return { deleted: true };
  }
}
