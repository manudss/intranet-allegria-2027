import {
  Body,
  Controller,
  Delete,
  Get,
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
import {
  AccessModule,
  AccessLevelRequired,
  VolunteerScope,
  VolunteerScopeAware,
} from '../auth/access-module.decorator';
import { CreateVolunteerDto, UpdateVolunteerDto } from './volunteers.types';
import { VolunteersService } from './volunteers.service';
import { FindVolunteersQueryDto } from '../volunteer-skills/volunteer-skills.types';

const READ_ROLES = ['ADMIN', 'COORDINATOR', 'HEALTH', 'VOLUNTEERS', 'LOGISTICS', 'VIEWER'];
const WRITE_ROLES = ['ADMIN', 'COORDINATOR'];

@ApiTags('Volunteers')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller('volunteers')
export class VolunteersController {
  constructor(private readonly volunteersService: VolunteersService) {}

  @ApiOperation({ summary: 'Creer un benevole' })
  @AccessModule('VOLUNTEER_DIRECTORY')
  @AccessLevelRequired('EDIT')
  @Post()
  create(@Body() dto: CreateVolunteerDto) {
    return this.volunteersService.create(dto);
  }

  @ApiOperation({ summary: 'Lister les benevoles' })
  @AccessModule('VOLUNTEER_DIRECTORY')
  @VolunteerScopeAware()
  @Get()
  findAll(@Query() query: FindVolunteersQueryDto, @VolunteerScope() visible: number[] | null) {
    return this.volunteersService.findAll(query, visible);
  }

  @ApiOperation({ summary: 'Rechercher des benevoles (selecteur, resultats limites)' })
  @AccessModule('VOLUNTEER_DIRECTORY')
  @VolunteerScopeAware()
  @Get('search')
  search(
    @VolunteerScope() visible: number[] | null,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const int = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
    return this.volunteersService.search(
      { q: q?.slice(0, 80), limit: int(limit), offset: int(offset) },
      visible,
    );
  }

  @ApiOperation({ summary: 'Recuperer un benevole par id' })
  @AccessModule('VOLUNTEER_DIRECTORY')
  @VolunteerScopeAware()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @VolunteerScope() visible: number[] | null) {
    return this.volunteersService.findOne(id, visible);
  }

  @ApiOperation({ summary: 'Mettre a jour un benevole' })
  @AccessModule('VOLUNTEER_DIRECTORY')
  @AccessLevelRequired('EDIT')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVolunteerDto) {
    return this.volunteersService.update(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer un benevole' })
  @AccessModule('VOLUNTEER_DIRECTORY')
  @AccessLevelRequired('EDIT')
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.volunteersService.remove(id);
    return { deleted: true };
  }
}
