import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AccessAuditAction,
  AccessScanDuplicateRule,
  AccessScanPoint,
  AccessScanType,
  AccessZone,
} from '../entities';
import { AccessAuditService } from './access-audit.service';
import { CreateScanPointDto, CreateScanTypeDto, CreateZoneDto } from './access-control.types';

@Injectable()
export class ScanConfigService {
  constructor(
    @InjectRepository(AccessScanType)
    private readonly scanTypesRepository: Repository<AccessScanType>,
    @InjectRepository(AccessZone)
    private readonly zonesRepository: Repository<AccessZone>,
    @InjectRepository(AccessScanPoint)
    private readonly pointsRepository: Repository<AccessScanPoint>,
    private readonly auditService: AccessAuditService,
  ) {}

  listScanTypes() {
    return this.scanTypesRepository.find({ order: { code: 'ASC' } });
  }

  async createScanType(dto: CreateScanTypeDto, actorId: number | null) {
    const scanType = await this.scanTypesRepository.save(
      this.scanTypesRepository.create({
        code: dto.code.trim().toUpperCase(),
        label: dto.label,
        description: dto.description ?? null,
        duplicateRule: dto.duplicateRule ?? AccessScanDuplicateRule.ALLOW,
      }),
    );
    await this.auditService.record({
      userId: actorId,
      action: AccessAuditAction.CONFIG_CHANGED,
      entityType: 'access_scan_types',
      entityId: scanType.id,
      details: { code: scanType.code, duplicateRule: scanType.duplicateRule },
    });
    return scanType;
  }

  listZones() {
    return this.zonesRepository.find({ order: { name: 'ASC' }, relations: { points: true } });
  }

  async createZone(dto: CreateZoneDto, actorId: number | null) {
    const zone = await this.zonesRepository.save(
      this.zonesRepository.create({
        name: dto.name,
        description: dto.description ?? null,
        allowedPersonTypes: dto.allowedPersonTypes ?? null,
        requiresOnlineValidation: dto.requiresOnlineValidation ?? false,
        maxOfflineMinutes: dto.maxOfflineMinutes ?? 240,
      }),
    );
    await this.auditService.record({
      userId: actorId,
      action: AccessAuditAction.CONFIG_CHANGED,
      entityType: 'access_zones',
      entityId: zone.id,
      details: { name: zone.name },
    });
    return zone;
  }

  async updateZone(id: number, dto: Partial<CreateZoneDto>, actorId: number | null) {
    const zone = await this.zonesRepository.findOneBy({ id });
    if (!zone) {
      throw new NotFoundException(`Zone ${id} introuvable`);
    }
    Object.assign(zone, {
      name: dto.name ?? zone.name,
      description: dto.description ?? zone.description,
      allowedPersonTypes: dto.allowedPersonTypes ?? zone.allowedPersonTypes,
      requiresOnlineValidation: dto.requiresOnlineValidation ?? zone.requiresOnlineValidation,
      maxOfflineMinutes: dto.maxOfflineMinutes ?? zone.maxOfflineMinutes,
    });
    const saved = await this.zonesRepository.save(zone);
    await this.auditService.record({
      userId: actorId,
      action: AccessAuditAction.CONFIG_CHANGED,
      entityType: 'access_zones',
      entityId: zone.id,
      details: { name: zone.name, updated: Object.keys(dto) },
    });
    return saved;
  }

  listPoints() {
    return this.pointsRepository.find({
      order: { id: 'ASC' },
      relations: { zone: true, scanType: true },
    });
  }

  async updatePoint(id: number, active: boolean, actorId: number) {
    const point = await this.pointsRepository.findOneBy({ id });
    if (!point) throw new NotFoundException('Point introuvable');
    point.active = active;
    const saved = await this.pointsRepository.save(point);
    await this.auditService.record({ userId: actorId, action: AccessAuditAction.CONFIG_CHANGED, entityType: 'access_scan_points', entityId: id, details: { active } });
    return saved;
  }

  async createPoint(dto: CreateScanPointDto, actorId: number | null) {
    const zone = await this.zonesRepository.findOneBy({ id: dto.zoneId });
    if (!zone) {
      throw new NotFoundException(`Zone ${dto.zoneId} introuvable`);
    }
    const scanType = await this.scanTypesRepository.findOneBy({ id: dto.scanTypeId });
    if (!scanType) {
      throw new NotFoundException(`Type de scan ${dto.scanTypeId} introuvable`);
    }
    const point = await this.pointsRepository.save(
      this.pointsRepository.create({
        zoneId: zone.id,
        scanTypeId: scanType.id,
        name: dto.name,
        serviceKey: dto.serviceKey ?? null,
        active: true,
      }),
    );
    await this.auditService.record({
      userId: actorId,
      action: AccessAuditAction.CONFIG_CHANGED,
      entityType: 'access_scan_points',
      entityId: point.id,
      details: { name: point.name, zoneId: zone.id, scanTypeId: scanType.id },
    });
    return point;
  }
}
