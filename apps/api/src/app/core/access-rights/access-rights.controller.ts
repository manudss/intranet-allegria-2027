import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import {
  ACCESS_LEVEL_LABELS,
  ACCESS_LEVELS,
  ACCESS_MODULES,
  ACCESS_SCOPE_LABELS,
  ACCESS_SCOPES,
} from './access-modules';
import { AccessRightsService, RuleInput } from './access-rights.service';

type Req_ = { user: { id: number; email: string; roles: string[] } };

@ApiTags('AccessRights')
@ApiBearerAuth('bearer')
@UseGuards(RoleGuard)
@Controller('access')
export class AccessRightsController {
  constructor(private readonly service: AccessRightsService) {}

  @ApiOperation({ summary: 'Mes droits effectifs (menu, écrans)' })
  @Get('me')
  async me(@Req() req: Req_) {
    const described = await this.service.describeUser(req.user.id);
    return (
      described ?? {
        user: req.user,
        roles: req.user.roles,
        teamTypes: [],
        groupIds: [],
        grants: [],
      }
    );
  }

  @ApiOperation({ summary: 'Modules, niveaux, portées, rôles et types d’équipes réglables' })
  @Roles('ADMIN')
  @Get('catalog')
  async catalog() {
    return {
      modules: ACCESS_MODULES,
      levels: ACCESS_LEVELS.map((code) => ({ code, label: ACCESS_LEVEL_LABELS[code] })),
      scopes: ACCESS_SCOPES.map((code) => ({ code, label: ACCESS_SCOPE_LABELS[code] })),
      ...(await this.service.subjects()),
    };
  }

  @ApiOperation({ summary: 'Toutes les règles de la matrice' })
  @Roles('ADMIN')
  @Get('rules')
  rules() {
    return this.service.listRules();
  }

  @ApiOperation({ summary: 'Enregistrer des cases de la matrice (tout ou rien, journalisé)' })
  @Roles('ADMIN')
  @Put('rules')
  saveRules(@Body() body: { rules: RuleInput[] }, @Req() req: Req_) {
    return this.service.saveRules(body?.rules, req.user);
  }

  @ApiOperation({ summary: 'Voir comme : droits effectifs d’une personne' })
  @Roles('ADMIN')
  @Get('users/:id/effective')
  async effective(@Param('id', ParseIntPipe) id: number) {
    return this.service.describeUser(id);
  }

  @ApiOperation({ summary: 'Groupes de rassemblement autorisés pour une personne' })
  @Roles('ADMIN')
  @Put('users/:id/groups')
  setGroups(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { groupIds: number[] },
    @Req() req: Req_,
  ) {
    return this.service.setUserGroups(id, body?.groupIds, req.user);
  }

  @ApiOperation({ summary: 'Exceptions individuelles' })
  @Roles('ADMIN')
  @Get('overrides')
  overrides() {
    return this.service.listOverrides();
  }

  @ApiOperation({
    summary: 'Créer une exception individuelle (motif obligatoire, date de fin conseillée)',
  })
  @Roles('ADMIN')
  @Post('overrides')
  createOverride(
    @Body()
    body: {
      userId: number;
      module: string;
      level: string;
      scope?: string;
      reason: string;
      expiresAt?: string | null;
    },
    @Req() req: Req_,
  ) {
    return this.service.createOverride(body, req.user);
  }

  @ApiOperation({ summary: 'Supprimer une exception individuelle' })
  @Roles('ADMIN')
  @Delete('overrides/:id')
  deleteOverride(@Param('id', ParseIntPipe) id: number, @Req() req: Req_) {
    return this.service.deleteOverride(id, req.user);
  }

  @ApiOperation({ summary: 'Journal des changements de droits' })
  @Roles('ADMIN')
  @Get('logs')
  logs(@Query('limit') limit?: string) {
    return this.service.listLogs(limit ? Number(limit) : 200);
  }
}
