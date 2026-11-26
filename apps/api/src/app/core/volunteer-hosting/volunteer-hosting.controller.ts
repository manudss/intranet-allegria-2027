import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { AccessModule, AccessLevelRequired } from '../auth/access-module.decorator';
import { VolunteerHostingService } from './volunteer-hosting.service';
import { CreateVolunteerHostingDto, UpdateVolunteerHostingDto } from './volunteer-hosting.types';

const READ_ROLES = ['ADMIN', 'COORDINATOR', 'VOLUNTEERS', 'LOGISTICS'];
const WRITE_ROLES = ['ADMIN', 'COORDINATOR', 'LOGISTICS'];

@ApiTags('VolunteerHosting')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller('volunteer-hosting')
export class VolunteerHostingController {
  constructor(private readonly hostingService: VolunteerHostingService) {}

  @ApiOperation({ summary: 'Lister les hébergements bénévoles (filtre volunteerId possible)' })
  @AccessModule('HOUSING')
  @Get()
  findAll(@Query('volunteerId') volunteerId?: string) {
    return this.hostingService.findAll(volunteerId ? Number(volunteerId) : undefined);
  }

  @ApiOperation({ summary: 'Créer l hébergement d un bénévole' })
  @AccessModule('HOUSING')
  @AccessLevelRequired('EDIT')
  @Post()
  create(@Body() dto: CreateVolunteerHostingDto) {
    return this.hostingService.create(dto);
  }

  @ApiOperation({ summary: 'Mettre à jour l hébergement d un bénévole' })
  @AccessModule('HOUSING')
  @AccessLevelRequired('EDIT')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVolunteerHostingDto) {
    return this.hostingService.update(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer l hébergement d un bénévole' })
  @AccessModule('HOUSING')
  @AccessLevelRequired('EDIT')
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.hostingService.remove(id);
  }
}
