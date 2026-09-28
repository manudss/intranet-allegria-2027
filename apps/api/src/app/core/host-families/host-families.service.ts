import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HostFamily } from '../entities';
import { CreateHostFamilyDto, UpdateHostFamilyDto } from './host-families.types';

@Injectable()
export class HostFamiliesService {
  constructor(
    @InjectRepository(HostFamily)
    private readonly hostFamiliesRepository: Repository<HostFamily>,
  ) {}

  create(dto: CreateHostFamilyDto): Promise<HostFamily> {
    const hostFamily = this.hostFamiliesRepository.create({
      ...dto,
      maxUnder18: dto.maxUnder18 ?? 0,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      parish: dto.parish ?? null,
      notes: dto.notes ?? null,
    });

    return this.hostFamiliesRepository.save(hostFamily);
  }

  findAll(): Promise<HostFamily[]> {
    return this.hostFamiliesRepository.find({ order: { familyName: 'ASC' } });
  }

  async findOne(id: number): Promise<HostFamily> {
    const hostFamily = await this.hostFamiliesRepository.findOneBy({ id });

    if (!hostFamily) {
      throw new NotFoundException(`Famille d'accueil ${id} introuvable`);
    }

    return hostFamily;
  }

  async update(id: number, dto: UpdateHostFamilyDto): Promise<HostFamily> {
    const hostFamily = await this.findOne(id);
    Object.assign(hostFamily, dto);
    return this.hostFamiliesRepository.save(hostFamily);
  }

  async remove(id: number): Promise<void> {
    const hostFamily = await this.findOne(id);
    await this.hostFamiliesRepository.remove(hostFamily);
  }
}

