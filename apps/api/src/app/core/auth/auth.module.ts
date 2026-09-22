import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role, User, UserRole } from '../entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenGuard } from './auth-token.guard';
import { RoleGuard } from './role.guard';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, UserRole])],
  controllers: [AuthController, UsersController, RolesController],
  providers: [AuthService, UsersService, RolesService, AuthTokenGuard, RoleGuard],
  exports: [AuthService, UsersService, RolesService, AuthTokenGuard, RoleGuard],
})
export class AuthModule {}
