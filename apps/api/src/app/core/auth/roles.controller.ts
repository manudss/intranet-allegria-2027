import { Roles } from './roles.decorator';
import { RoleGuard } from './role.guard';
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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateRoleDto } from './auth.types';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@UseGuards(RoleGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ApiOperation({ summary: 'Creer un role' })
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @ApiOperation({ summary: 'Lister les roles' })
  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @ApiOperation({ summary: 'Affecter un role a un utilisateur' })
  @Roles('ADMIN')
  @Post('users/:userId/:roleId')
  assignRole(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.rolesService.assignRole(userId, roleId);
  }

  @ApiOperation({ summary: 'Retirer un role a un utilisateur' })
  @Roles('ADMIN')
  @Delete('users/:userId/:roleId')
  async unassignRole(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    await this.rolesService.unassignRole(userId, roleId);
    return { deleted: true };
  }
}
