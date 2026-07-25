import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, User, UserRole } from '../entities';
import { CreateRoleDto } from './auth.types';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRolesRepository: Repository<UserRole>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  create(dto: CreateRoleDto): Promise<Role> {
    const role = this.rolesRepository.create({
      code: dto.code.trim().toUpperCase(),
      label: dto.label,
    });

    return this.rolesRepository.save(role);
  }

  findAll(): Promise<Role[]> {
    return this.rolesRepository.find({ order: { code: 'ASC' } });
  }

  async assignRole(userId: number, roleId: number): Promise<UserRole> {
    const user = await this.usersRepository.findOneBy({ id: userId });
    const role = await this.rolesRepository.findOneBy({ id: roleId });

    if (!user) {
      throw new NotFoundException(`Utilisateur ${userId} introuvable`);
    }

    if (!role) {
      throw new NotFoundException(`Role ${roleId} introuvable`);
    }

    const link = this.userRolesRepository.create({
      user,
      role,
      userId: user.id,
      roleId: role.id,
    });

    return this.userRolesRepository.save(link);
  }

  async unassignRole(userId: number, roleId: number): Promise<void> {
    const link = await this.userRolesRepository.findOneBy({ userId, roleId });

    if (!link) {
      throw new NotFoundException(`Affectation role user=${userId} role=${roleId} introuvable`);
    }

    await this.userRolesRepository.remove(link);
  }
}

