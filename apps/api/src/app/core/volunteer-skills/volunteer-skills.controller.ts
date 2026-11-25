import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { AccessModule, AccessLevelRequired } from '../auth/access-module.decorator';
import { AddSkillDto, AddTagDto } from './volunteer-skills.types';
import { VolunteerSkillsService } from './volunteer-skills.service';

const READ_ROLES = ['ADMIN', 'COORDINATOR', 'HEALTH', 'VOLUNTEERS', 'LOGISTICS', 'VIEWER'];
const WRITE_ROLES = ['ADMIN', 'COORDINATOR', 'HEALTH', 'VOLUNTEERS', 'LOGISTICS'];

@ApiTags('VolunteerSkills')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller()
export class VolunteerSkillsController {
  constructor(private readonly volunteerSkillsService: VolunteerSkillsService) {}

  // ── Suggestions partagées ──────────────────────────────────────────────────

  @ApiOperation({ summary: 'Suggestions de tags déjà utilisés' })
  @AccessModule('OPERATIONAL_TEAMS')
  @Get('volunteer-tags/suggestions')
  getTagSuggestions(@Query('q') q?: string) {
    return this.volunteerSkillsService.getTagSuggestions(q);
  }

  @ApiOperation({ summary: 'Nombre de bénévoles par compétence' })
  @AccessModule('OPERATIONAL_TEAMS')
  @Get('volunteer-skills/counts')
  getSkillUsageCounts() {
    return this.volunteerSkillsService.getSkillUsageCounts();
  }

  // ── Compétences par bénévole ───────────────────────────────────────────────

  @ApiOperation({ summary: "Lister les compétences d'un bénévole" })
  @AccessModule('OPERATIONAL_TEAMS')
  @Get('volunteers/:volunteerId/skills')
  listSkills(@Param('volunteerId', ParseIntPipe) volunteerId: number) {
    return this.volunteerSkillsService.listSkills(volunteerId);
  }

  @ApiOperation({ summary: 'Ajouter une compétence à un bénévole' })
  @AccessModule('OPERATIONAL_TEAMS')
  @AccessLevelRequired('EDIT')
  @Post('volunteers/:volunteerId/skills')
  addSkill(
    @Req() req: { user: { id: number; email: string; roles: string[] } },
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @Body() dto: AddSkillDto,
  ) {
    return this.volunteerSkillsService.addSkill(req.user, volunteerId, dto);
  }

  @ApiOperation({ summary: "Supprimer une compétence d'un bénévole" })
  @AccessModule('OPERATIONAL_TEAMS')
  @AccessLevelRequired('EDIT')
  @Delete('volunteers/:volunteerId/skills/:skillId')
  async removeSkill(
    @Req() req: { user: { id: number; email: string; roles: string[] } },
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @Param('skillId', ParseIntPipe) skillId: number,
  ) {
    await this.volunteerSkillsService.removeSkill(req.user, volunteerId, skillId);
    return { deleted: true };
  }

  // ── Tags par bénévole ──────────────────────────────────────────────────────

  @ApiOperation({ summary: "Lister les tags d'un bénévole" })
  @AccessModule('OPERATIONAL_TEAMS')
  @Get('volunteers/:volunteerId/tags')
  listTags(@Param('volunteerId', ParseIntPipe) volunteerId: number) {
    return this.volunteerSkillsService.listTags(volunteerId);
  }

  @ApiOperation({ summary: 'Ajouter un tag à un bénévole' })
  @AccessModule('OPERATIONAL_TEAMS')
  @AccessLevelRequired('EDIT')
  @Post('volunteers/:volunteerId/tags')
  addTag(
    @Req() req: { user: { id: number; email: string; roles: string[] } },
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @Body() dto: AddTagDto,
  ) {
    return this.volunteerSkillsService.addTag(req.user, volunteerId, dto);
  }

  @ApiOperation({ summary: "Supprimer un tag d'un bénévole" })
  @AccessModule('OPERATIONAL_TEAMS')
  @AccessLevelRequired('EDIT')
  @Delete('volunteers/:volunteerId/tags/:tagId')
  async removeTag(
    @Req() req: { user: { id: number; email: string; roles: string[] } },
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @Param('tagId', ParseIntPipe) tagId: number,
  ) {
    await this.volunteerSkillsService.removeTag(req.user, volunteerId, tagId);
    return { deleted: true };
  }
}
