import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThan, Or, Repository } from 'typeorm';
import { AccessAuditAction, AccessScannerGrant, AccessZone, User } from '../entities';
import { AccessAuditService } from './access-audit.service';
import { CreateScannerGrantDto } from './access-control.types';

@Injectable()
export class ScannerGrantsService {
  constructor(
    @InjectRepository(AccessScannerGrant)
    private readonly grantsRepository: Repository<AccessScannerGrant>,
    @InjectRepository(AccessZone)
    private readonly zonesRepository: Repository<AccessZone>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly auditService: AccessAuditService,
  ) {}

  list() {
    return this.grantsRepository.find({
      relations: { user: true, zone: true },
      select: { id: true, userId: true, zoneId: true, startsAt: true, endsAt: true, createdByUserId: true, user: { id: true, email: true }, zone: { id: true, name: true } },
      order: { id: 'DESC' },
    });
  }

  async create(dto: CreateScannerGrantDto, actorId: number | null) {
    if (dto.endsAt && new Date(dto.endsAt) <= (dto.startsAt ? new Date(dto.startsAt) : new Date())) throw new BadRequestException('La fin doit suivre le début');
    const user = await this.usersRepository.findOneBy({ id: dto.userId });
    if (!user) {
      throw new NotFoundException(`Utilisateur ${dto.userId} introuvable`);
    }
    if (dto.zoneId != null) {
      const zone = await this.zonesRepository.findOneBy({ id: dto.zoneId });
      if (!zone) {
        throw new NotFoundException(`Zone ${dto.zoneId} introuvable`);
      }
    }
    const grant = await this.grantsRepository.save(
      this.grantsRepository.create({
        userId: user.id,
        zoneId: dto.zoneId ?? null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : new Date(),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        createdByUserId: actorId,
      }),
    );
    await this.auditService.record({
      userId: actorId,
      action: AccessAuditAction.SCANNER_GRANTED,
      entityType: 'access_scanner_grants',
      entityId: grant.id,
      details: { scannerUserId: user.id, zoneId: grant.zoneId, endsAt: grant.endsAt },
    });
    return grant;
  }

  /** Révocation d'un clic : le grant prend fin immédiatement. */
  async revoke(id: number, actorId: number | null) {
    const grant = await this.grantsRepository.findOneBy({ id });
    if (!grant) {
      throw new NotFoundException(`Habilitation ${id} introuvable`);
    }
    grant.endsAt = new Date();
    const saved = await this.grantsRepository.save(grant);
    await this.auditService.record({
      userId: actorId,
      action: AccessAuditAction.SCANNER_REVOKED,
      entityType: 'access_scanner_grants',
      entityId: grant.id,
      details: { scannerUserId: grant.userId, zoneId: grant.zoneId },
    });
    return saved;
  }

  /** Vérifie que l'utilisateur a un grant actif couvrant la zone demandée. */
  async assertActiveGrant(userId: number, zoneId: number | null): Promise<void> {
    const now = new Date();
    const grants = await this.grantsRepository.find({
      where: {
        userId,
        startsAt: LessThan(now),
        endsAt: Or(IsNull(), MoreThan(now)),
      },
    });
    const covers = grants.some((grant) => grant.zoneId == null || grant.zoneId === zoneId);
    if (!covers) {
      throw new ForbiddenException(
        zoneId == null
          ? 'Aucune habilitation de scan active'
          : `Aucune habilitation de scan active pour la zone ${zoneId}`,
      );
    }
  }

  async hasActiveGrant(userId: number, zoneId: number | null): Promise<boolean> {
    try {
      await this.assertActiveGrant(userId, zoneId);
      return true;
    } catch {
      return false;
    }
  }
}
