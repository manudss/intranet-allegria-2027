import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';

@ApiTags('HostFamilies')
@Controller('host-families')
export class HostFamilyAssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get(':id/assignments')
  @ApiOperation({ summary: "Lister les affectations d'une famille d'accueil" })
  findByHostFamily(@Param('id', ParseIntPipe) id: number) {
    return this.assignmentsService.findByHostFamily(id);
  }
}
