import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessModule } from '../auth/access-module.decorator';
import { RoleGuard } from '../auth/role.guard';
import { GatheringTransportsService } from './gathering-transports.service';
import {
  AddCarPersonDto,
  AssignTargetsDto,
  CreateCarDto,
  SetStopsDto,
  SetTransportNeedDto,
  UpdateCarDto,
} from './gathering-transports.types';

/**
 * Transports du rassemblement : cars, arrêts, affectations des groupes et lieux
 * à desservir, exceptions individuelles. Droit TRANSPORT de la matrice
 * (GET = voir, PATCH/PUT = modifier, POST/DELETE = gérer), portée « tout »
 * requise comme pour les écrans des délégations.
 */
@ApiTags('GatheringTransports')
@UseGuards(RoleGuard)
@AccessModule('TRANSPORT')
@Controller('gathering-transports')
export class GatheringTransportsController {
  constructor(private readonly service: GatheringTransportsService) {}

  @ApiOperation({ summary: 'Tableau : cibles à desservir et cars avec jauges' })
  @Get('board')
  board() {
    return this.service.board();
  }

  @ApiOperation({ summary: 'Marquer le besoin de transport d\'un groupe d\'hébergement' })
  @Patch('hosting-groups/:id/transport-need')
  setGroupNeed(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: SetTransportNeedDto,
  ) {
    return this.service.setGroupTransportNeed(id, dto.needsTransport);
  }

  @ApiOperation({ summary: 'Marquer le besoin de transport d\'une famille ou d\'un hébergement' })
  @Patch('host-families/:id/transport-need')
  setFamilyNeed(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: SetTransportNeedDto,
  ) {
    return this.service.setFamilyTransportNeed(id, dto.needsTransport);
  }

  @ApiOperation({ summary: 'Créer un car du rassemblement' })
  @Post('cars')
  createCar(@Body(new ValidationPipe({ whitelist: true })) dto: CreateCarDto) {
    return this.service.createCar(dto);
  }

  @ApiOperation({ summary: 'Mettre à jour un car (libellé, jauge, jours, notes)' })
  @Patch('cars/:id')
  updateCar(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateCarDto,
  ) {
    return this.service.updateCar(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer un car (ses cibles retournent dans « à desservir »)' })
  @Delete('cars/:id')
  async removeCar(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeCar(id);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Remplacer les arrêts ordonnés d\'un car' })
  @Put('cars/:id/stops')
  setStops(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: SetStopsDto,
  ) {
    return this.service.setStops(id, dto.stops);
  }

  @ApiOperation({ summary: 'Affecter des cibles (groupes, hébergements) à un car' })
  @Put('cars/:id/assignments')
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: AssignTargetsDto,
  ) {
    return this.service.assign(id, dto.targets);
  }

  @ApiOperation({ summary: 'Retirer une cible d\'un car (retour dans « à desservir »)' })
  @Delete('assignments/:assignmentId')
  async unassign(@Param('assignmentId', ParseIntPipe) assignmentId: number) {
    await this.service.unassign(assignmentId);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Ajouter ou retirer une personne en exception sur un car' })
  @Post('cars/:id/persons')
  addPerson(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: AddCarPersonDto,
  ) {
    return this.service.addPerson(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer une exception individuelle' })
  @Delete('persons/:personRowId')
  async removePerson(@Param('personRowId', ParseIntPipe) personRowId: number) {
    await this.service.removePersonRow(personRowId);
    return { deleted: true };
  }
}
