import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AccessModule } from '../auth/access-module.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';

@ApiTags('HostFamilies')
@UseGuards(RoleGuard)
@AccessModule('HOST_FAMILIES')
@Controller('host-families')
export class HostFamilyAssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get(':id/assignments')
  @ApiOperation({ summary: "Lister les affectations d'une famille d'accueil" })
  findByHostFamily(@Param('id', ParseIntPipe) id: number) {
    return this.assignmentsService.findByHostFamily(id);
  }
}
