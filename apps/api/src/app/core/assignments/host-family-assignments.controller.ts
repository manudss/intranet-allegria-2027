import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import {
  AccessModule,
  AccessScope,
  AccessScopeInfo,
  GroupScopeAware,
} from '../auth/access-module.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';

@ApiTags('HostFamilies')
@UseGuards(RoleGuard)
@AccessModule('HOST_FAMILIES')
@GroupScopeAware()
@Controller('host-families')
export class HostFamilyAssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get(':id/assignments')
  @ApiOperation({ summary: "Lister les affectations d'une famille d'accueil" })
  findByHostFamily(@Param('id', ParseIntPipe) id: number, @AccessScope() scope: AccessScopeInfo) {
    return this.assignmentsService.findByHostFamily(id, scope);
  }
}
