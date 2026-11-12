import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { AccessAuditService } from './access-audit.service';
import { BadgesService } from './badges.service';
import { ScanConfigService } from './scan-config.service';
import { ScannerGrantsService } from './scanner-grants.service';
import { ScanSessionsService } from './scan-sessions.service';
import { ScansService } from './scans.service';
import { ACCESS_CONTROL_ROLES } from './access-control.constants';
import {
  AssignBadgeDto,
  CreateScannerGrantDto,
  CreateScanPointDto,
  CreateScanTypeDto,
  CreateZoneDto,
  ListBadgesQueryDto,
  LookupCodeDto,
  RegisterBadgeStockDto,
  ReplaceBadgeDto,
  RevokeBadgeDto,
  StartScanSessionDto,
  UploadScansDto,
} from './access-control.types';
import { AccessAuditAction } from '../entities';

type UserRequest = { user: { id: number; email: string; roles: string[] } };

const MANAGE_ROLES = ['ADMIN', ACCESS_CONTROL_ROLES.badgeManager];
const SCAN_ROLES = ['ADMIN', ACCESS_CONTROL_ROLES.scanner];

@ApiTags('Access Control - Badges')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller('access-control/badges')
export class AccessBadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @ApiOperation({ summary: 'Enregistrer un lot de QR pré-imprimés (codes fournis ou générés)' })
  @Roles(...MANAGE_ROLES)
  @Post('stock')
  registerStock(@Body() dto: RegisterBadgeStockDto, @Req() req: UserRequest) {
    return this.badgesService.registerStock(dto, req.user.id);
  }

  @ApiOperation({ summary: 'Lister le stock de badges (filtres statut/lot/préfixe)' })
  @Roles(...MANAGE_ROLES)
  @Get()
  list(@Query() query: ListBadgesQueryDto) {
    return this.badgesService.list(query);
  }

  @ApiOperation({ summary: 'Consulter un badge par son code (état et affectations)' })
  @Roles(...MANAGE_ROLES)
  @Get('by-code/:code')
  findByCode(@Param('code') code: string) {
    return this.badgesService.findByCode(code);
  }

  @ApiOperation({ summary: 'Attribuer un badge disponible à une personne (un seul actif par personne)' })
  @Roles(...MANAGE_ROLES)
  @Post('assign')
  assign(@Body() dto: AssignBadgeDto, @Req() req: UserRequest) {
    return this.badgesService.assign(dto, req.user.id);
  }

  @ApiOperation({ summary: 'Remplacer un badge perdu : révocation atomique de l’ancien + nouveau' })
  @Roles(...MANAGE_ROLES)
  @Post('replace')
  replace(@Body() dto: ReplaceBadgeDto, @Req() req: UserRequest) {
    return this.badgesService.replace(dto, req.user.id);
  }

  @ApiOperation({ summary: 'Révoquer un badge (clôt son affectation active)' })
  @Roles(...MANAGE_ROLES)
  @Post(':id/revoke')
  revoke(@Param('id', ParseIntPipe) id: number, @Body() dto: RevokeBadgeDto, @Req() req: UserRequest) {
    return this.badgesService.revoke(id, dto.reason, req.user.id);
  }

  @ApiOperation({ summary: 'Historique des affectations d’une personne (jamais réécrit)' })
  @Roles(...MANAGE_ROLES)
  @Get('participants/:participantId/history')
  history(@Param('participantId', ParseIntPipe) participantId: number) {
    return this.badgesService.historyForParticipant(participantId);
  }
}

@ApiTags('Access Control - Configuration')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller('access-control/config')
export class AccessConfigController {
  constructor(private readonly configService: ScanConfigService) {}

  @ApiOperation({ summary: 'Lister les types de scan' })
  @Roles(...MANAGE_ROLES)
  @Get('scan-types')
  listScanTypes() {
    return this.configService.listScanTypes();
  }

  @ApiOperation({ summary: 'Créer un type de scan (règle de doublon incluse)' })
  @Roles(...MANAGE_ROLES)
  @Post('scan-types')
  createScanType(@Body() dto: CreateScanTypeDto, @Req() req: UserRequest) {
    return this.configService.createScanType(dto, req.user.id);
  }

  @ApiOperation({ summary: 'Lister les zones et leurs points' })
  @Roles(...MANAGE_ROLES)
  @Get('zones')
  listZones() {
    return this.configService.listZones();
  }

  @ApiOperation({ summary: 'Créer une zone (droits, contrôle en ligne, délai hors ligne)' })
  @Roles(...MANAGE_ROLES)
  @Post('zones')
  createZone(@Body() dto: CreateZoneDto, @Req() req: UserRequest) {
    return this.configService.createZone(dto, req.user.id);
  }

  @ApiOperation({ summary: 'Régler une zone' })
  @Roles(...MANAGE_ROLES)
  @Patch('zones/:id')
  updateZone(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateZoneDto>, @Req() req: UserRequest) {
    return this.configService.updateZone(id, dto, req.user.id);
  }

  @ApiOperation({ summary: 'Lister les points de scan' })
  @Roles(...MANAGE_ROLES)
  @Get('points')
  listPoints() {
    return this.configService.listPoints();
  }

  @ApiOperation({ summary: 'Créer un point de scan' })
  @Roles(...MANAGE_ROLES)
  @Post('points')
  createPoint(@Body() dto: CreateScanPointDto, @Req() req: UserRequest) {
    return this.configService.createPoint(dto, req.user.id);
  }
}

@ApiTags('Access Control - Scanner grants')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller('access-control')
export class AccessGrantsController {
  constructor(
    private readonly grantsService: ScannerGrantsService,
    private readonly auditService: AccessAuditService,
  ) {}

  @ApiOperation({ summary: 'Lister les habilitations de scan (qui, zone, période)' })
  @Roles(...MANAGE_ROLES)
  @Get('scanner-grants')
  list() {
    return this.grantsService.list();
  }

  @ApiOperation({ summary: 'Habiliter un scanner, limité par zone et par période' })
  @Roles(...MANAGE_ROLES)
  @Post('scanner-grants')
  create(@Body() dto: CreateScannerGrantDto, @Req() req: UserRequest) {
    return this.grantsService.create(dto, req.user.id);
  }

  @ApiOperation({ summary: 'Retirer une habilitation de scan (effet immédiat)' })
  @Roles(...MANAGE_ROLES)
  @Post('scanner-grants/:id/revoke')
  revoke(@Param('id', ParseIntPipe) id: number, @Req() req: UserRequest) {
    return this.grantsService.revoke(id, req.user.id);
  }

  @ApiOperation({ summary: 'Journal d’audit du contrôle d’accès' })
  @Roles(...MANAGE_ROLES)
  @Get('audit')
  audit(@Query('action') action?: AccessAuditAction, @Query('userId') userId?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.auditService.search({
      action,
      userId: userId ? Number(userId) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}

@ApiTags('Access Control - Scan')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller('access-control/scan')
export class AccessScanningController {
  constructor(
    private readonly sessionsService: ScanSessionsService,
    private readonly scansService: ScansService,
  ) {}

  @ApiOperation({ summary: 'Entrer en mode scan : session bornée + clé + instantané versionné' })
  @Roles(...SCAN_ROLES)
  @Post('sessions')
  start(@Body() dto: StartScanSessionDto, @Req() req: UserRequest) {
    return this.sessionsService.start(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Redemander la clé locale (refus si rôle retiré ou session finie)' })
  @Roles(...SCAN_ROLES)
  @Get('sessions/:id/key')
  getKey(@Param('id', ParseIntPipe) id: number, @Req() req: UserRequest) {
    return this.sessionsService.getOrRenewKey(id, req.user.id);
  }

  @ApiOperation({ summary: 'Deltas d’affectations depuis une version (y compris révocations)' })
  @Roles(...SCAN_ROLES)
  @Get('sessions/:id/delta')
  delta(@Param('id', ParseIntPipe) id: number, @Query('since') since: string, @Req() req: UserRequest) {
    return this.sessionsService.delta(id, req.user.id, Number(since ?? 0));
  }

  @ApiOperation({ summary: 'Envoyer les scans en attente par lots (idempotent)' })
  @Roles(...SCAN_ROLES)
  @Post('sessions/:id/scans')
  upload(@Param('id', ParseIntPipe) id: number, @Body() dto: UploadScansDto, @Req() req: UserRequest) {
    return this.scansService.upload(id, req.user.id, dto);
  }

  @ApiOperation({ summary: 'Sortir du mode scan (après l’envoi des scans)' })
  @Roles(...SCAN_ROLES)
  @Post('sessions/:id/close')
  close(@Param('id', ParseIntPipe) id: number, @Req() req: UserRequest) {
    return this.sessionsService.close(id, req.user.id);
  }

  @ApiOperation({ summary: 'Code inconnu de la table locale : verdict du serveur, débit limité' })
  @Roles(...SCAN_ROLES)
  @Post('lookup')
  lookup(@Body() dto: LookupCodeDto, @Req() req: UserRequest) {
    return this.scansService.lookup(req.user.id, dto.code, dto.pointId);
  }
}
