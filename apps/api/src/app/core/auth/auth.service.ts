import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, User, UserRole } from '../entities';
import { LoginDto } from './auth.types';
import { verifyPassword } from './password.util';

type SessionUser = {
  id: number;
  email: string;
  roles: string[];
};

@Injectable()
export class AuthService {
  private readonly sessions = new Map<string, SessionUser>();

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRolesRepository: Repository<UserRole>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersRepository.findOneBy({ email: dto.email.toLowerCase().trim() });

    if (!user || !user.isActive || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Email ou mot de passe invalide');
    }

    const roles = await this.findUserRoleCodes(user.id);
    const token = randomUUID();

    this.sessions.set(token, {
      id: user.id,
      email: user.email,
      roles,
    });

    return {
      accessToken: token,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        roles,
      },
    };
  }

  async resolveToken(token: string): Promise<SessionUser | null> {
    const sessionUser = this.sessions.get(token);

    if (!sessionUser) {
      return null;
    }

    // Reload roles from DB to keep RBAC checks up to date even with long-lived sessions.
    const freshRoles = await this.findUserRoleCodes(sessionUser.id);

    return {
      ...sessionUser,
      roles: freshRoles,
    };
  }

  private async findUserRoleCodes(userId: number): Promise<string[]> {
    const userRoles = await this.userRolesRepository.find({
      where: { userId },
      relations: ['role'],
    });

    return userRoles.map((row) => row.role.code);
  }
}

