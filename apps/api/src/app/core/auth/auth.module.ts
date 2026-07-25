import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role, User, UserRole } from '../entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenGuard } from './auth-token.guard';
import { RoleGuard } from './role.guard';
import { RolesModule } from './roles.module';
import { UsersModule } from './users.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, UserRole]), UsersModule, RolesModule],
  controllers: [AuthController],
  providers: [AuthService, AuthTokenGuard, RoleGuard],
  exports: [AuthService, AuthTokenGuard, RoleGuard, UsersModule, RolesModule],
})
export class AuthModule {}



