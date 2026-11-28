import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { AccessLevelRequired, AccessModule, GatheringScope, GatheringScopeInfo, GatheringScopeAware } from '../auth/access-module.decorator';
import { AccessRightsService } from '../access-rights/access-rights.service';
import { ForbiddenException } from '@nestjs/common';
import { PlacesService } from './places.service';
import { GeocodingService } from './geocoding.service';
import { CreatePlaceDto, GeocodeDto, PlaceListQuery, RoomDto, SetTeamsDto, UpdatePlaceDto } from './places.types';
import { PICKER_MODULES, hasAny } from './places.rights';

type Req = { user: { id: number; roles: string[] } };

/** Lieux et salles : module PLACES de la matrice (Voir / Modifier / Gérer), contrôlé côté serveur. */
@ApiTags('Places')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
@AccessModule('PLACES')
@GatheringScopeAware()
@Controller('places')
export class PlacesController {
  constructor(
    private readonly service: PlacesService,
    private readonly rights: AccessRightsService,
    private readonly geocoder: GeocodingService,
  ) {}

  @ApiOperation({ summary: 'Recherche d\'adresse (Nominatim, côté serveur, 1 requête/s, sur clic uniquement)' })
  @AccessLevelRequired('EDIT')
  @Post('geocode')
  geocode(@Body() dto: GeocodeDto) {
    return this.geocoder.search(dto.query);
  }

  @ApiOperation({ summary: 'Liste des lieux (filtre par type, recherche)' })
  @Get()
  async list(@Query() query: PlaceListQuery, @Req() req: Req) {
    return this.service.list(query, await this.rights.effective(req.user.id, req.user.roles));
  }

  @ApiOperation({ summary: 'Textes de lieu libres non rattachés, limités aux modules que la personne voit' })
  @Get('unlinked')
  async unlinked(@Req() req: Req) {
    return this.service.unlinkedTexts(await this.rights.effective(req.user.id, req.user.roles));
  }

  @ApiOperation({ summary: 'Fiche complète d\'un lieu, relations filtrées par les droits de chaque module source' })
  @Get(':id')
  async fiche(@Param('id', ParseIntPipe) id: number, @Req() req: Req, @GatheringScope() scope: GatheringScopeInfo) {
    const grants = await this.rights.effective(req.user.id, req.user.roles);
    return this.service.fiche(id, grants, scope, await this.rights.gatheringGroupIdsForUser(req.user.id));
  }

  @ApiOperation({ summary: 'Créer un lieu' })
  @AccessLevelRequired('EDIT')
  @Post()
  create(@Body() dto: CreatePlaceDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Modifier un lieu (adresse, point GPS, infos, responsable)' })
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlaceDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer un lieu (refusé s\'il est utilisé)' })
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @ApiOperation({ summary: 'Ajouter une salle (nom seul)' })
  @AccessLevelRequired('EDIT')
  @Post(':id/rooms')
  addRoom(@Param('id', ParseIntPipe) id: number, @Body() dto: RoomDto) {
    return this.service.addRoom(id, dto);
  }

  @ApiOperation({ summary: 'Renommer une salle' })
  @Patch(':id/rooms/:roomId')
  renameRoom(@Param('id', ParseIntPipe) id: number, @Param('roomId', ParseIntPipe) roomId: number, @Body() dto: RoomDto) {
    return this.service.renameRoom(id, roomId, dto);
  }

  @ApiOperation({ summary: 'Supprimer une salle (refusé si utilisée)' })
  @AccessLevelRequired('EDIT')
  @Delete(':id/rooms/:roomId')
  removeRoom(@Param('id', ParseIntPipe) id: number, @Param('roomId', ParseIntPipe) roomId: number) {
    return this.service.removeRoom(id, roomId);
  }

  @ApiOperation({ summary: 'Définir les équipes de bénévoles portées par le lieu' })
  @Put(':id/teams')
  @AccessLevelRequired('EDIT')
  setTeams(@Param('id', ParseIntPipe) id: number, @Body() dto: SetTeamsDto) {
    return this.service.setTeams(id, dto.volunteerTeamIds);
  }
}

/**
 * Options du sélecteur de lieu : nom, type et salles seulement (ni adresse, ni GPS, ni relations).
 * Ouvertes à qui voit les lieux ou doit en choisir un depuis un module qui les utilise.
 */
@ApiTags('Places')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller('place-options')
export class PlaceOptionsController {
  constructor(
    private readonly service: PlacesService,
    private readonly rights: AccessRightsService,
  ) {}

  @ApiOperation({ summary: 'Lieux et salles pour le sélecteur' })
  @Get()
  async options(@Req() req: Req) {
    const grants = await this.rights.effective(req.user.id, req.user.roles);
    if (!PICKER_MODULES.some((m) => hasAny(grants, m))) throw new ForbiddenException('Droits insuffisants');
    return this.service.options();
  }
}
