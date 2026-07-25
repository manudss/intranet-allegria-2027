import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthTokenGuard } from './auth-token.guard';
import { CreateUserDto, UpdateUserDto } from './auth.types';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private withoutPasswordHash<T extends { passwordHash?: string }>(user: T): Omit<T, 'passwordHash'> {
    const safeUser = { ...user };
    delete safeUser.passwordHash;
    return safeUser;
  }

  @UseGuards(AuthTokenGuard)
  @Get('me')
  getMe(@Req() request: { user: { id: number; email: string; roles: string[] } }) {
    return request.user;
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return this.withoutPasswordHash(user);
  }

  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map((user) => this.withoutPasswordHash(user));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findOne(id);
    return this.withoutPasswordHash(user);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.update(id, dto);
    return this.withoutPasswordHash(user);
  }
}

