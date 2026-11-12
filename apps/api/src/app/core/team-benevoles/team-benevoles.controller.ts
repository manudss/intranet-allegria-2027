import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { TeamBenevolesService } from './team-benevoles.service';
import { AssignBenevoleDto } from './team-benevoles.types';

const READ_ROLES = ['ADMIN', 'COORDINATOR', 'VOLUNTEERS', 'LOGISTICS'];
const WRITE_ROLES = ['ADMIN', 'COORDINATOR', 'LOGISTICS'];

@ApiTags('TeamBenevoles')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller()
export class TeamBenevolesController {
  constructor(private readonly service: TeamBenevolesService) {}

  @ApiOperation({ summary: 'Toutes les affectations bénévoles aux équipes (board de placement)' })
  @Roles(...READ_ROLES)
  @Get('benevoles/assignments')
  listAssignments() {
    return this.service.listAssignments();
  }

  @ApiOperation({ summary: 'Bénévoles (adultes) affectés à une équipe' })
  @Roles(...READ_ROLES)
  @Get('teams/:id/benevoles')
  listForTeam(@Param('id', ParseIntPipe) id: number) {
    return this.service.listForTeam(id);
  }

  @ApiOperation({
    summary:
      'Affecter un bénévole à une équipe en tant qu adulte (compte dans la capacité et le quota adultes)',
  })
  @Roles(...WRITE_ROLES)
  @Post('teams/:id/benevoles')
  assign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignBenevoleDto) {
    return this.service.assign(id, dto);
  }

  @ApiOperation({ summary: 'Retirer un bénévole d une équipe (refusé s il est placé en famille)' })
  @Roles(...WRITE_ROLES)
  @Delete('teams/:id/benevoles/:volunteerId')
  async unassign(
    @Param('id', ParseIntPipe) id: number,
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
  ) {
    await this.service.unassign(id, volunteerId);
    return { deleted: true };
  }
}
