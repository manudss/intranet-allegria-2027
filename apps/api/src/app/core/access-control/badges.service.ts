import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import {
  AccessAuditAction,
  AccessBadge,
  AccessBadgeAssignment,
  AccessBadgeStatus,
  Participant,
} from '../entities';
import { AccessAuditService } from './access-audit.service';
import {
  AssignBadgeDto,
  ListBadgesQueryDto,
  RegisterBadgeStockDto,
  ReplaceBadgeDto,
} from './access-control.types';

const UNIQUE_VIOLATION = '23505';

/** Génère un code opaque fort, sans aucune donnée personnelle. */
export const generateBadgeCode = (): string => randomBytes(16).toString('hex');

@Injectable()
export class BadgesService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(AccessBadge)
    private readonly badgesRepository: Repository<AccessBadge>,
    @InjectRepository(AccessBadgeAssignment)
    private readonly assignmentsRepository: Repository<AccessBadgeAssignment>,
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    private readonly auditService: AccessAuditService,
  ) {}

  /** Incrémente la version globale dans la transaction courante. */
  private async bumpMetaVersion(manager: EntityManager): Promise<number> {
    const rows: { version: number }[] = await manager.query(
      `INSERT INTO access_control_meta (id, version) VALUES (1, 1)
       ON CONFLICT (id) DO UPDATE SET version = access_control_meta.version + 1
       RETURNING version`,
    );
    return rows[0].version;
  }

  async registerStock(dto: RegisterBadgeStockDto, actorId: number | null) {
    const lot = dto.lot?.trim();
    if (!lot) {
      throw new BadRequestException('Le lot est obligatoire');
    }

    let codes = (dto.codes ?? []).map((code) => code.trim()).filter(Boolean);
    if (codes.length === 0) {
      const count = dto.count ?? 0;
      if (!Number.isInteger(count) || count <= 0 || count > 10000) {
        throw new BadRequestException('Fournir des codes imprimés ou un count entre 1 et 10000');
      }
      codes = Array.from({ length: count }, () => generateBadgeCode());
    }

    const badges = codes.map((code) =>
      this.badgesRepository.create({ code, lot, status: AccessBadgeStatus.AVAILABLE }),
    );
    // Les doublons (déjà enregistrés) sont ignorés : un même code n'entre qu'une fois.
    const result = await this.badgesRepository
      .createQueryBuilder()
      .insert()
      .values(badges)
      .orIgnore()
      .execute();

    const added = result.identifiers.filter((identifier) => identifier?.id != null).length;
    await this.auditService.record({
      userId: actorId,
      action: AccessAuditAction.BADGE_STOCK_ADDED,
      entityType: 'access_badges',
      details: { lot, requested: codes.length, added, skipped: codes.length - added },
    });

    return { lot, requested: codes.length, added, skipped: codes.length - added, codes };
  }

  async list(query: ListBadgesQueryDto) {
    const qb = this.badgesRepository
      .createQueryBuilder('badge')
      .orderBy('badge.id', 'ASC')
      .take(Math.min(Number(query.limit ?? 50) || 50, 200))
      .skip(Number(query.offset ?? 0) || 0);

    if (query.status) {
      qb.andWhere('badge.status = :status', { status: query.status });
    }
    if (query.lot) {
      qb.andWhere('badge.lot = :lot', { lot: query.lot });
    }
    if (query.q) {
      qb.andWhere('badge.code LIKE :q', { q: `${query.q}%` });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findByCode(code: string) {
    const badge = await this.badgesRepository.findOne({
      where: { code },
      relations: { assignments: true },
    });
    if (!badge) {
      throw new NotFoundException(`Badge ${code} introuvable`);
    }
    return badge;
  }

  private async nextBadgeVersion(manager: EntityManager, badgeId: number): Promise<number> {
    const rows: { max: number | null }[] = await manager.query(
      `SELECT MAX(version) AS max FROM access_badge_assignments WHERE badge_id = $1`,
      [badgeId],
    );
    return (rows[0]?.max ?? 0) + 1;
  }

  private async findActiveAssignment(
    manager: EntityManager,
    participantId: number,
  ): Promise<AccessBadgeAssignment | null> {
    return manager.getRepository(AccessBadgeAssignment).findOne({
      where: { participantId, endsAt: IsNull() },
    });
  }

  private async findExistingOperation(operationId: string | undefined) {
    if (!operationId) {
      return null;
    }
    return this.assignmentsRepository.findOne({ where: { operationId } });
  }

  private async lockBadge(manager: EntityManager, where: { id?: number; code?: string }) {
    const qb = manager
      .getRepository(AccessBadge)
      .createQueryBuilder('badge')
      .setLock('pessimistic_write');
    if (where.id != null) {
      qb.where('badge.id = :id', { id: where.id });
    } else {
      qb.where('badge.code = :code', { code: where.code });
    }
    return qb.getOne();
  }

  private assertAssignable(badge: AccessBadge | null, ref: string): AccessBadge {
    if (!badge) {
      throw new NotFoundException(`Badge ${ref} introuvable`);
    }
    if (badge.status === AccessBadgeStatus.LOST || badge.status === AccessBadgeStatus.REVOKED) {
      // Proposition du plan appliquée par défaut : un code perdu ou révoqué
      // ne retourne jamais dans le stock actif pendant l'événement.
      throw new ConflictException(`Le badge ${ref} est ${badge.status} et ne peut pas être réattribué`);
    }
    if (badge.status !== AccessBadgeStatus.AVAILABLE) {
      throw new ConflictException(`Le badge ${ref} n'est pas disponible (${badge.status})`);
    }
    return badge;
  }

  async assign(dto: AssignBadgeDto, actorId: number | null) {
    const existing = await this.findExistingOperation(dto.operationId);
    if (existing) {
      return existing;
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const participant = await manager.getRepository(Participant).findOneBy({ id: dto.participantId });
        if (!participant) {
          throw new NotFoundException(`Participant ${dto.participantId} introuvable`);
        }

        const active = await this.findActiveAssignment(manager, dto.participantId);
        if (active) {
          // Proposition du plan (question 1) appliquée par défaut :
          // un seul badge actif par personne, jamais d'ajout silencieux.
          throw new ConflictException(
            `Le participant ${dto.participantId} a déjà un badge actif (affectation ${active.id})`,
          );
        }

        const badge = this.assertAssignable(
          await this.lockBadge(manager, { id: dto.badgeId, code: dto.badgeCode }),
          dto.badgeCode ?? String(dto.badgeId),
        );

        const metaVersion = await this.bumpMetaVersion(manager);
        const assignment = await manager.getRepository(AccessBadgeAssignment).save(
          manager.getRepository(AccessBadgeAssignment).create({
            badgeId: badge.id,
            participantId: participant.id,
            version: await this.nextBadgeVersion(manager, badge.id),
            metaCreatedVersion: metaVersion,
            reason: dto.reason ?? null,
            createdByUserId: actorId,
            operationId: dto.operationId ?? null,
          }),
        );
        badge.status = AccessBadgeStatus.ASSIGNED;
        await manager.getRepository(AccessBadge).save(badge);

        await this.auditService.record(
          {
            userId: actorId,
            action: AccessAuditAction.BADGE_ASSIGNED,
            entityType: 'access_badge_assignments',
            entityId: assignment.id,
            details: { badgeId: badge.id, code: badge.code, participantId: participant.id },
          },
          manager,
        );
        return assignment;
      });
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        // Double attribution concurrente : les contraintes serveur tranchent.
        throw new ConflictException('Attribution concurrente refusée par les contraintes serveur');
      }
      throw error;
    }
  }

  async replace(dto: ReplaceBadgeDto, actorId: number | null) {
    const existing = await this.findExistingOperation(dto.operationId);
    if (existing) {
      return existing;
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const participant = await manager.getRepository(Participant).findOneBy({ id: dto.participantId });
        if (!participant) {
          throw new NotFoundException(`Participant ${dto.participantId} introuvable`);
        }

        const current = await this.findActiveAssignment(manager, dto.participantId);
        if (!current) {
          throw new ConflictException(`Le participant ${dto.participantId} n'a pas de badge actif à remplacer`);
        }

        const newBadge = this.assertAssignable(
          await this.lockBadge(manager, { code: dto.newBadgeCode }),
          dto.newBadgeCode,
        );

        const metaVersion = await this.bumpMetaVersion(manager);
        const now = new Date();

        // Une seule transaction : clôturer l'ancienne affectation, marquer
        // l'ancien code perdu, ouvrir la nouvelle. Aucune modification partielle.
        current.endsAt = now;
        current.metaClosedVersion = metaVersion;
        await manager.getRepository(AccessBadgeAssignment).save(current);

        const oldBadge = await manager.getRepository(AccessBadge).findOneBy({ id: current.badgeId });
        if (oldBadge) {
          oldBadge.status = AccessBadgeStatus.LOST;
          await manager.getRepository(AccessBadge).save(oldBadge);
        }

        const assignment = await manager.getRepository(AccessBadgeAssignment).save(
          manager.getRepository(AccessBadgeAssignment).create({
            badgeId: newBadge.id,
            participantId: participant.id,
            version: await this.nextBadgeVersion(manager, newBadge.id),
            metaCreatedVersion: metaVersion,
            reason: dto.reason ?? 'Badge perdu',
            createdByUserId: actorId,
            operationId: dto.operationId ?? null,
          }),
        );
        newBadge.status = AccessBadgeStatus.ASSIGNED;
        await manager.getRepository(AccessBadge).save(newBadge);

        await this.auditService.record(
          {
            userId: actorId,
            action: AccessAuditAction.BADGE_REPLACED,
            entityType: 'access_badge_assignments',
            entityId: assignment.id,
            details: {
              participantId: participant.id,
              oldBadgeId: current.badgeId,
              oldAssignmentId: current.id,
              newBadgeId: newBadge.id,
              newCode: newBadge.code,
              reason: dto.reason ?? 'Badge perdu',
            },
          },
          manager,
        );
        return assignment;
      });
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('Remplacement concurrent refusé par les contraintes serveur');
      }
      throw error;
    }
  }

  async revoke(badgeId: number, reason: string | undefined, actorId: number | null) {
    return this.dataSource.transaction(async (manager) => {
      const badge = await this.lockBadge(manager, { id: badgeId });
      if (!badge) {
        throw new NotFoundException(`Badge ${badgeId} introuvable`);
      }

      const metaVersion = await this.bumpMetaVersion(manager);
      const active = await manager.getRepository(AccessBadgeAssignment).findOne({
        where: { badgeId: badge.id, endsAt: IsNull() },
      });
      if (active) {
        active.endsAt = new Date();
        active.metaClosedVersion = metaVersion;
        await manager.getRepository(AccessBadgeAssignment).save(active);
      }
      badge.status = AccessBadgeStatus.REVOKED;
      await manager.getRepository(AccessBadge).save(badge);

      await this.auditService.record(
        {
          userId: actorId,
          action: AccessAuditAction.BADGE_REVOKED,
          entityType: 'access_badges',
          entityId: badge.id,
          details: { code: badge.code, participantId: active?.participantId ?? null, reason: reason ?? null },
        },
        manager,
      );
      return badge;
    });
  }

  async historyForParticipant(participantId: number) {
    const participant = await this.participantsRepository.findOneBy({ id: participantId });
    if (!participant) {
      throw new NotFoundException(`Participant ${participantId} introuvable`);
    }
    return this.assignmentsRepository.find({
      where: { participantId },
      relations: { badge: true },
      order: { id: 'DESC' },
    });
  }
}
