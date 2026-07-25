import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities';
import { CreateUserDto, UpdateUserDto } from './auth.types';
import { hashPassword } from './password.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create({
      email: dto.email.toLowerCase().trim(),
      passwordHash: hashPassword(dto.password),
      isActive: dto.isActive ?? true,
    });

    return this.usersRepository.save(user);
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException(`Utilisateur ${id} introuvable`);
    }

    return user;
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (Object.prototype.hasOwnProperty.call(dto, 'password') && dto.password) {
      user.passwordHash = hashPassword(dto.password);
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'isActive') && typeof dto.isActive === 'boolean') {
      user.isActive = dto.isActive;
    }

    return this.usersRepository.save(user);
  }
}

