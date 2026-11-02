import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { ProgramService } from './program.service';
import {
  ChangeLogQueryDto,
  CreateSequenceDto,
  InsertSequenceApplyDto,
  InsertSequenceDto,
  ProgramRequestUser,
  ResizeSequenceApplyDto,
  ResizeSequenceDto,
  UpdateSequenceDto,
} from './program.types';

const READ_ROLES = ['ADMIN', 'COORDINATOR', 'HEALTH', 'ANIMATOR', 'LOGISTICS', 'VIEWER'];
const WRITE_ROLES = ['ADMIN', 'COORDINATOR'];

type UserRequest = { user: ProgramRequestUser };

function requireVersion(version: string | undefined): string {
  if (!version) {
    throw new BadRequestException("La version de l'aperçu est obligatoire.");
  }
  return version;
}

@ApiTags('Program')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller('program')
export class ProgramController {
  constructor(private readonly service: ProgramService) {}

  @ApiOperation({ summary: 'Séquences du jour (tous lieux, branches incluses)' })
  @Roles(...READ_ROLES)
  @Get('days/:date')
  getDay(@Param('date') date: string) {
    return this.service.getDay(date);
  }

  @ApiOperation({ summary: "Crée la première séquence d'un jour/lieu vide (ou une branche)" })
  @Roles(...WRITE_ROLES)
  @Post('sequences')
  create(@Req() req: UserRequest, @Body() dto: CreateSequenceDto) {
    return this.service.createSequence(req.user, dto);
  }

  @ApiOperation({ summary: 'Modifie titre, notes, équipe, missions et liens documentaires' })
  @Roles(...WRITE_ROLES)
  @Patch('sequences/:id')
  update(
    @Req() req: UserRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSequenceDto,
  ) {
    return this.service.updateSequence(req.user, id, dto);
  }

  @ApiOperation({ summary: 'Supprime une séquence mobile (la suivante est reconnectée)' })
  @Roles(...WRITE_ROLES)
  @Delete('sequences/:id')
  remove(
    @Req() req: UserRequest,
    @Param('id', ParseIntPipe) id: number,
    @Query('closeGap') closeGap?: string,
  ) {
    return this.service.deleteSequence(req.user, id, { closeGap: closeGap === 'true' });
  }

  @ApiOperation({ summary: "Aperçu de l'insertion d'une séquence après la séquence donnée" })
  @Roles(...WRITE_ROLES)
  @Post('sequences/:id/insert-after/preview')
  previewInsert(@Param('id', ParseIntPipe) id: number, @Body() dto: InsertSequenceDto) {
    return this.service.previewInsert(id, dto);
  }

  @ApiOperation({ summary: "Applique l'insertion (refusée si la chaîne a changé depuis l'aperçu)" })
  @Roles(...WRITE_ROLES)
  @Post('sequences/:id/insert-after/apply')
  applyInsert(
    @Req() req: UserRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InsertSequenceApplyDto,
  ) {
    return this.service.applyInsert(req.user, id, dto, requireVersion(dto.version));
  }

  @ApiOperation({ summary: "Aperçu du redimensionnement d'une séquence" })
  @Roles(...WRITE_ROLES)
  @Patch('sequences/:id/resize/preview')
  previewResize(@Param('id', ParseIntPipe) id: number, @Body() dto: ResizeSequenceDto) {
    return this.service.previewResize(id, dto);
  }

  @ApiOperation({ summary: 'Applique le redimensionnement (refusé si la chaîne a changé)' })
  @Roles(...WRITE_ROLES)
  @Patch('sequences/:id/resize/apply')
  applyResize(
    @Req() req: UserRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResizeSequenceApplyDto,
  ) {
    return this.service.applyResize(req.user, id, dto, requireVersion(dto.version));
  }

  @ApiOperation({ summary: 'Figer une séquence (coordination)' })
  @Roles(...WRITE_ROLES)
  @Patch('sequences/:id/freeze')
  freeze(@Req() req: UserRequest, @Param('id', ParseIntPipe) id: number) {
    return this.service.freeze(req.user, id);
  }

  @ApiOperation({ summary: 'Défiger une séquence (coordination)' })
  @Roles(...WRITE_ROLES)
  @Patch('sequences/:id/unfreeze')
  unfreeze(@Req() req: UserRequest, @Param('id', ParseIntPipe) id: number) {
    return this.service.unfreeze(req.user, id);
  }

  @ApiOperation({ summary: "Remplace le programme d'un jour par la démonstration fictive (admin)" })
  @Roles('ADMIN')
  @Post('days/:date/demo-reset')
  resetDayToDemo(@Req() req: UserRequest, @Param('date') date: string) {
    return this.service.resetDayToDemo(req.user, date);
  }

  @ApiOperation({ summary: 'Journal des modifications du programme' })
  @Roles(...READ_ROLES)
  @Get('change-log')
  getChangeLog(@Query() query: ChangeLogQueryDto) {
    return this.service.getChangeLog(query);
  }
}
