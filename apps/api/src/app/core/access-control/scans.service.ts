import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';
import {
  AccessAuditAction,
  AccessAuditLog,
  AccessBadge,
  AccessBadgeAssignment,
  AccessBadgeStatus,
  AccessScanDuplicateRule,
  AccessScanEvent,
  AccessScanPoint,
  AccessScanVerdict,
} from '../entities';
import { AccessAuditService } from './access-audit.service';
import { LookupResult, ScanBatchItemDto, ScanVerdictResult, UploadScansDto } from './access-control.types';
import { UNKNOWN_CODE_BURST_WINDOW_MINUTES } from './access-control.constants';
import { LookupRateLimiterService } from './lookup-rate-limiter.service';
import { ScannerGrantsService } from './scanner-grants.service';
import { ScanSessionsService } from './scan-sessions.service';

const UNIQUE_VIOLATION = '23505';

type PointContext = {
  point: AccessScanPoint;
  zoneAllowedTypes: string[] | null;
  duplicateRule: AccessScanDuplicateRule;
};

@Injectable()
export class ScansService {
  constructor(
    @InjectRepository(AccessScanEvent)
    private readonly eventsRepository: Repository<AccessScanEvent>,
    @InjectRepository(AccessScanPoint)
    private readonly pointsRepository: Repository<AccessScanPoint>,
    @InjectRepository(AccessBadge)
    private readonly badgesRepository: Repository<AccessBadge>,
    @InjectRepository(AccessBadgeAssignment)
    private readonly assignmentsRepository: Repository<AccessBadgeAssignment>,
    @InjectRepository(AccessAuditLog)
    private readonly auditRepository: Repository<AccessAuditLog>,
    private readonly sessionsService: ScanSessionsService,
    private readonly grantsService: ScannerGrantsService,
    private readonly auditService: AccessAuditService,
    private readonly rateLimiter: LookupRateLimiterService,
  ) {}

  private async loadPointContext(pointId: number): Promise<PointContext> {
    const point = await this.pointsRepository.findOne({
      where: { id: pointId },
      relations: { zone: true, scanType: true },
    });
    if (!point || !point.active) {
      throw new NotFoundException(`Point de scan ${pointId} introuvable ou inactif`);
    }
    return {
      point,
      zoneAllowedTypes: point.zone?.allowedPersonTypes?.length ? point.zone.allowedPersonTypes : null,
      duplicateRule: point.scanType.duplicateRule,
    };
  }

  private serviceKeyOf(context: PointContext, scan: ScanBatchItemDto): string | null {
    if (scan.serviceKey != null && scan.serviceKey !== context.point.serviceKey) {
      throw new BadRequestException('Le service doit correspondre au point');
    }
    return context.point.serviceKey;
  }

  /**
   * Doublon : compté par PERSONNE (pas par badge) pour qu'un badge neuf ne
   * redonne pas un repas après remplacement.
   */
  private async findDuplicate(
    context: PointContext,
    participantId: number,
    serviceKey: string | null,
    occurredAt: Date,
    events = this.eventsRepository,
  ): Promise<AccessScanEvent | null> {
    if (context.duplicateRule === AccessScanDuplicateRule.ALLOW) {
      return null;
    }
    if (context.duplicateRule === AccessScanDuplicateRule.UNIQUE_PER_SERVICE) {
      return events.findOne({
        where: {
          participantId,
          scanTypeId: context.point.scanTypeId,
          serviceKey: serviceKey ?? IsNull(),
          verdict: AccessScanVerdict.ACCEPTED,
        },
      });
    }
    const dayStart = new Date(occurredAt);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    return events.findOne({
      where: {
        participantId,
        scanTypeId: context.point.scanTypeId,
        verdict: AccessScanVerdict.ACCEPTED,
        receivedAt: Between(dayStart, dayEnd),
      },
    });
  }

  /** Décision serveur pour un code, partagée par l'upload et le repli en ligne. */
  private async decide(
    context: PointContext,
    code: string,
    assignmentId: number | undefined,
    serviceKey: string | null,
    occurredAt: Date,
    events = this.eventsRepository,
  ): Promise<{ verdict: AccessScanVerdict; assignment: AccessBadgeAssignment | null; duplicateOf?: AccessScanEvent; needsReview: boolean }> {
    const badge = await this.badgesRepository.findOneBy({ code });
    if (!badge) {
      return { verdict: AccessScanVerdict.REJECTED_UNKNOWN, assignment: null, needsReview: true };
    }

    const assignment = assignmentId
      ? await this.assignmentsRepository.findOne({
          where: { id: assignmentId },
          relations: { participant: true },
        })
      : await this.assignmentsRepository.findOne({
          where: { badgeId: badge.id, endsAt: IsNull() },
          relations: { participant: true },
        });

    if (!assignment || assignment.badgeId !== badge.id) {
      return {
        verdict:
          badge.status === AccessBadgeStatus.LOST || badge.status === AccessBadgeStatus.REVOKED
            ? AccessScanVerdict.REJECTED_REVOKED
            : AccessScanVerdict.REJECTED_UNKNOWN,
        assignment: null,
        needsReview: true,
      };
    }

    // Le serveur tranche avec sa base à jour, pas avec la table du scanner :
    // affectation clôturée (remplacée/révoquée depuis la synchro) = refus.
    if (assignment.endsAt !== null || badge.status !== AccessBadgeStatus.ASSIGNED) {
      return {
        verdict: AccessScanVerdict.REJECTED_EXPIRED_ASSIGNMENT,
        assignment,
        needsReview: true, // scan tardif ou ambigu : à vérifier, jamais réattribué
      };
    }

    if (context.zoneAllowedTypes && !context.zoneAllowedTypes.includes(assignment.participant.type)) {
      return { verdict: AccessScanVerdict.REJECTED_NO_RIGHT, assignment, needsReview: false };
    }

    const duplicate = await this.findDuplicate(context, assignment.participantId, serviceKey, occurredAt, events);
    if (duplicate) {
      return { verdict: AccessScanVerdict.DUPLICATE, assignment, duplicateOf: duplicate, needsReview: false };
    }

    return { verdict: AccessScanVerdict.ACCEPTED, assignment, needsReview: false };
  }

  /** Envoi par lots, idempotent : un clientEventId = un seul événement. */
  async upload(sessionId: number, userId: number, dto: UploadScansDto): Promise<ScanVerdictResult[]> {
    // Shared database locks, not in-process mutexes: works across API replicas.
    // Lock scan types in a fixed order to avoid cross-batch deadlocks.
    return this.eventsRepository.manager.transaction(async manager => {
      const contexts = await Promise.all([...new Set(dto.scans.map(s => s.pointId))].map(id => this.loadPointContext(id)));
      const typeIds = [...new Set(contexts.filter(c => c.duplicateRule !== AccessScanDuplicateRule.ALLOW).map(c => c.point.scanTypeId))].sort((a, b) => a - b);
      for (const typeId of typeIds) await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [21027, typeId]);
      for (const id of [...new Set(dto.scans.map(s => s.clientEventId))].sort()) {
        await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [id]);
      }
      return this.uploadBatch(sessionId, userId, dto, manager.getRepository(AccessScanEvent));
    });
  }

  private async uploadBatch(sessionId: number, userId: number, dto: UploadScansDto, events: Repository<AccessScanEvent>): Promise<ScanVerdictResult[]> {
    const session = await this.sessionsService.findOwnedSession(sessionId, userId);
    const results: ScanVerdictResult[] = [];

    for (const scan of dto.scans ?? []) {
      if (!scan.clientEventId || !scan.code || !scan.pointId) {
        throw new BadRequestException('Chaque scan exige clientEventId, code et pointId');
      }

      const existing = await events.findOneBy({ clientEventId: scan.clientEventId });
      if (existing) {
        // Répétition réseau du téléphone : on renvoie le verdict déjà tranché.
        results.push({ clientEventId: scan.clientEventId, verdict: existing.verdict });
        continue;
      }

      const context = await this.loadPointContext(scan.pointId);
      if (session.zoneId != null && session.zoneId !== context.point.zoneId) {
        throw new ForbiddenException('Point hors de la zone de session');
      }
      const occurredAt = scan.occurredAtLocal ? new Date(scan.occurredAtLocal) : new Date();
      if (Number.isNaN(occurredAt.getTime())) throw new BadRequestException('Horodatage invalide');
      const decision = await this.decide(
        context,
        scan.code,
        scan.assignmentId,
        this.serviceKeyOf(context, scan),
        occurredAt,
        events,
      );

      try {
        const event = await events.save(
          events.create({
            sessionId: session.id,
            assignmentId: decision.assignment?.id ?? null,
            participantId: decision.assignment?.participantId ?? null,
            badgeId: decision.assignment?.badgeId ?? null,
            code: scan.code,
            tableVersion: scan.tableVersion ?? null,
            pointId: context.point.id,
            scanTypeId: context.point.scanTypeId,
            occurredAtLocal: scan.occurredAtLocal ? occurredAt : null,
            verdict: decision.verdict,
            serviceKey: this.serviceKeyOf(context, scan),
            clientEventId: scan.clientEventId,
            needsReview: scan.clientAccepted === false || decision.needsReview || session.expiresAt <= new Date() || !!session.closedAt
              || occurredAt < session.startedAt || occurredAt > session.expiresAt,

          }),
        );
        results.push({
          clientEventId: scan.clientEventId,
          verdict: event.verdict,
          duplicateOfEventId: decision.duplicateOf?.id,
        });
      } catch (error) {
        if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
          const raced = await events.findOneBy({ clientEventId: scan.clientEventId });
          if (raced) {
            results.push({ clientEventId: scan.clientEventId, verdict: raced.verdict });
            continue;
          }
        }
        throw error;
      }
    }
    return results;
  }

  /**
   * Repli en ligne pour un code inconnu de la table locale (décidé à 22:17).
   * Encadrement proposé : rôle scanner + habilitation sur la zone du point,
   * verdict seul sans dévoiler la table, débit limité, rafales journalisées.
   */
  async lookup(userId: number, code: string, pointId: number): Promise<LookupResult> {
    if (!this.rateLimiter.tryConsume(userId)) {
      await this.auditService.record({
        userId,
        action: AccessAuditAction.LOOKUP_RATE_LIMITED,
        entityType: 'access_scan_points',
        entityId: pointId,
        details: { code },
      });
      throw new HttpException('Trop de recherches de codes inconnus', HttpStatus.TOO_MANY_REQUESTS);
    }

    const context = await this.loadPointContext(pointId);
    await this.grantsService.assertActiveGrant(userId, context.point.zoneId);

    const decision = await this.decide(context, code, undefined, context.point.serviceKey, new Date());

    if (decision.verdict === AccessScanVerdict.REJECTED_UNKNOWN) {
      const since = new Date(Date.now() - UNKNOWN_CODE_BURST_WINDOW_MINUTES * 60_000);
      const recentUnknowns = await this.auditRepository.count({
        where: { action: AccessAuditAction.UNKNOWN_CODE_LOOKUP, createdAt: Between(since, new Date()) },
      });
      // Un code inconnu répété est remonté au journal (détail "repeated").
      await this.auditService.record({
        userId,
        action: AccessAuditAction.UNKNOWN_CODE_LOOKUP,
        entityType: 'access_scan_points',
        entityId: pointId,
        details: { code, repeated: recentUnknowns > 0 },
      });
    }

    // Verdict seul par défaut (question 9 du plan, proposition) : pas de nom,
    // la table n'est jamais dévoilée par cet endpoint.
    return { verdict: decision.verdict };
  }
}
