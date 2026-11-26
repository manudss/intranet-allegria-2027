import { AccessModule } from './access-module.decorator';
import { RoleGuard } from './role.guard';
import {
  Body,
  Controller,
  ForbiddenException,
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
import { AuthTokenGuard } from './auth-token.guard';
import { CreateUserDto, UpdateUserDto } from './auth.types';
import { UsersService } from './users.service';
import { AccessRightsService } from '../access-rights/access-rights.service';

/** Modules dont la matrice de droits ouvre la recherche de comptes : écrans qui l'utilisent. */
const SEARCH_MODULES = ['ADMIN', 'BADGES'];

@ApiTags('Users')
@UseGuards(RoleGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accessRights: AccessRightsService,
  ) {}

  private withoutPasswordHash<T extends { passwordHash?: string }>(
    user: T,
  ): Omit<T, 'passwordHash'> {
    const safeUser = { ...user };
    delete safeUser.passwordHash;
    return safeUser;
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Retourner l utilisateur authentifie courant' })
  @UseGuards(AuthTokenGuard)
  @Get('me')
  getMe(@Req() request: { user: { id: number; email: string; roles: string[] } }) {
    return request.user;
  }

  @ApiOperation({ summary: 'Creer un utilisateur' })
  @AccessModule('ADMIN')
  @Post()
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return this.withoutPasswordHash(user);
  }

  @ApiOperation({ summary: 'Lister les utilisateurs' })
  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map((user) => this.withoutPasswordHash(user));
  }

  @ApiOperation({
    summary: 'Rechercher des utilisateurs (selecteur de personne, resultats limites)',
  })
  @ApiBearerAuth('bearer')
  @Get('search')
  async search(
    @Req() request: { user?: { id: number; roles: string[] } },
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('teamType') teamType?: string,
    @Query('teamId') teamId?: string,
    @Query('groupId') groupId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // Autorité = matrice de droits (droits effectifs : rôles, types d'équipe, dérogations).
    // Un compte dont les droits ADMIN/BADGES sont retirés perd la recherche, même avec un ancien rôle.
    // Portée « tout » exigée : la recherche porte sur tous les comptes.
    const user = request.user;
    if (!user) throw new ForbiddenException('Utilisateur non authentifie');
    const grants = await this.accessRights.effective(user.id, user.roles);
    const allowed = SEARCH_MODULES.some((m) =>
      (grants[m]?.pairs ?? []).some((p) => p.scope === 'ALL'),
    );
    if (!allowed) throw new ForbiddenException('Droits insuffisants pour rechercher des comptes');
    const int = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
    return this.usersService.search({
      q: q?.slice(0, 80),
      role: role?.slice(0, 80),
      teamType: teamType?.slice(0, 80),
      teamId: int(teamId),
      groupId: int(groupId),
      limit: int(limit),
      offset: int(offset),
    });
  }

  @ApiOperation({ summary: 'Recuperer un utilisateur par id' })
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findOne(id);
    return this.withoutPasswordHash(user);
  }

  @ApiOperation({ summary: 'Mettre a jour un utilisateur' })
  @AccessModule('ADMIN')
  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.update(id, dto);
    return this.withoutPasswordHash(user);
  }
}
