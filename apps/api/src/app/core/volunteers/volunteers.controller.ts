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
import { Roles } from '../auth/roles.decorator';
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
  @Roles(...WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateVolunteerDto) {
    return this.volunteersService.create(dto);
  }

  @ApiOperation({ summary: 'Lister les benevoles' })
  @Roles(...READ_ROLES)
  @Get()
  findAll(@Query() query: FindVolunteersQueryDto) {
    return this.volunteersService.findAll(query);
  }

  @ApiOperation({ summary: 'Recuperer un benevole par id' })
  @Roles(...READ_ROLES)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.volunteersService.findOne(id);
  }

  @ApiOperation({ summary: 'Mettre a jour un benevole' })
  @Roles(...WRITE_ROLES)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVolunteerDto) {
    return this.volunteersService.update(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer un benevole' })
  @Roles(...WRITE_ROLES)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.volunteersService.remove(id);
    return { deleted: true };
  }
}
