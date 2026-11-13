import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import {
  AccessAuditAction,
  AccessBadgeAssignment,
  AccessControlMeta,
  AccessScanSession,
  AccessZone,
  Participant,
  PersonType,
} from '../entities';
import { AccessAuditService } from './access-audit.service';
import { SnapshotEntry, StartScanSessionDto } from './access-control.types';
import { SCAN_SESSION_KEY_TTL_MINUTES, SCAN_SESSION_TTL_MINUTES } from './access-control.constants';
import { ScannerGrantsService } from './scanner-grants.service';

const newSessionKey = (): string => randomBytes(24).toString('base64url');

@Injectable()
export class ScanSessionsService {
  constructor(
    @InjectRepository(AccessScanSession)
    private readonly sessionsRepository: Repository<AccessScanSession>,
    @InjectRepository(AccessBadgeAssignment)
    private readonly assignmentsRepository: Repository<AccessBadgeAssignment>,
    @InjectRepository(AccessControlMeta)
    private readonly metaRepository: Repository<AccessControlMeta>,
    @InjectRepository(AccessZone)
    private readonly zonesRepository: Repository<AccessZone>,
    private readonly grantsService: ScannerGrantsService,
    private readonly auditService: AccessAuditService,
  ) {}

  private async currentMetaVersion(): Promise<number> {
    const meta = await this.metaRepository.findOneBy({ id: 1 });
    return meta?.version ?? 0;
  }

  /** Instantané minimal : code, nom, prénom, droits utiles, rien d'autre. */
  private async buildSnapshot(zone: AccessZone | null): Promise<SnapshotEntry[]> {
    const qb = this.assignmentsRepository
      .createQueryBuilder('assignment')
      .innerJoin('assignment.badge', 'badge')
      .innerJoinAndMapOne(
        'assignment.participant',
        Participant,
        'participant',
        'participant.id = assignment.participant_id',
      )
      .select([
        'assignment.id AS "assignmentId"',
        'badge.code AS "code"',
        'participant."firstName" AS "firstName"',
        'participant."lastName" AS "lastName"',
        'participant.type AS "personType"',
        'assignment.version AS "version"',
      ])
      .where('assignment.endsAt IS NULL')
      .orderBy('assignment.id', 'ASC');

    // Téléchargement limité aux personnes utiles au scanner quand la zone
    // restreint les types admis : pas les 800 par défaut sur une zone ciblée.
    if (zone?.allowedPersonTypes?.length) {
      qb.andWhere('participant.type IN (:...types)', { types: zone.allowedPersonTypes });
    }

    return qb.getRawMany<SnapshotEntry>();
  }

  private async expectedOnline(zoneId: number | null): Promise<boolean> {
    return (
      (
        await this.sessionsRepository.manager.query(
          `SELECT 1 FROM access_expected_passages x JOIN access_scan_points pt ON pt.id=x.point_id WHERE ($1::int IS NULL OR pt.zone_id=$1) AND x.archived_at IS NULL LIMIT 1`,
          [zoneId],
        )
      ).length > 0
    );
  }

  async start(userId: number, dto: StartScanSessionDto) {
    const zoneId = dto.zoneId ?? null;
    let zone: AccessZone | null = null;
    if (zoneId != null) {
      zone = await this.zonesRepository.findOneBy({ id: zoneId });
      if (!zone) {
        throw new NotFoundException(`Zone ${zoneId} introuvable`);
      }
    }

    // Rôle SCANNER (garde du contrôleur) + habilitation active zone/période.
    await this.grantsService.assertActiveGrant(userId, zoneId);

    const now = new Date();
    const snapshotVersion = await this.currentMetaVersion();
    const session = await this.sessionsRepository.save(
      this.sessionsRepository.create({
        userId,
        zoneId,
        expiresAt: new Date(now.getTime() + SCAN_SESSION_TTL_MINUTES * 60_000),
        keyExpiresAt: new Date(now.getTime() + SCAN_SESSION_KEY_TTL_MINUTES * 60_000),
        snapshotVersion,
        sessionKey: newSessionKey(),
      }),
    );

    await this.auditService.record({
      userId,
      action: AccessAuditAction.SCAN_SESSION_STARTED,
      entityType: 'access_scan_sessions',
      entityId: session.id,
      details: { zoneId, snapshotVersion },
    });

    const snapshot = await this.buildSnapshot(zone);
    return {
      sessionId: session.id,
      zoneId,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      keyExpiresAt: session.keyExpiresAt,
      sessionKey: session.sessionKey,
      snapshotVersion,
      maxOfflineMinutes: zone?.maxOfflineMinutes ?? 240,
      requiresOnlineValidation:
        (zone?.requiresOnlineValidation ?? false) || (await this.expectedOnline(zoneId)),
      snapshot,
    };
  }

  private async requireOpenSession(sessionId: number, userId: number): Promise<AccessScanSession> {
    const session = await this.sessionsRepository.findOneBy({ id: sessionId });
    if (!session || session.userId !== userId) {
      throw new NotFoundException(`Session de scan ${sessionId} introuvable`);
    }
    if (session.closedAt || session.expiresAt <= new Date()) {
      throw new GoneException('La session de scan est terminée ou expirée');
    }
    return session;
  }

  /**
   * Le téléphone redemande la clé au serveur : rôle retiré, habilitation
   * terminée ou session close coupent l'accès dès le prochain contact réseau.
   */
  async getOrRenewKey(sessionId: number, userId: number) {
    const session = await this.requireOpenSession(sessionId, userId);
    await this.grantsService.assertActiveGrant(userId, session.zoneId);

    const now = new Date();
    if (session.keyExpiresAt > now) {
      return { sessionKey: session.sessionKey, keyExpiresAt: session.keyExpiresAt };
    }
    session.sessionKey = newSessionKey();
    session.keyExpiresAt = new Date(now.getTime() + SCAN_SESSION_KEY_TTL_MINUTES * 60_000);
    const saved = await this.sessionsRepository.save(session);
    return { sessionKey: saved.sessionKey, keyExpiresAt: saved.keyExpiresAt };
  }

  /**
   * Deltas depuis une version : nouvelles affectations ET fins d'affectation
   * (révocations), pour qu'un badge révoqué disparaisse des tables locales.
   */
  async delta(sessionId: number, userId: number, sinceVersion: number) {
    const session = await this.requireOpenSession(sessionId, userId);
    await this.grantsService.assertActiveGrant(userId, session.zoneId);

    const since = Math.max(0, Number(sinceVersion) || 0);
    const upsertAssignments = await this.assignmentsRepository.find({
      where: { metaCreatedVersion: MoreThan(since), endsAt: IsNull() },
      relations: { badge: true, participant: true },
    });
    const revoked = await this.assignmentsRepository.find({
      where: { metaClosedVersion: MoreThan(since) },
    });

    let zone: AccessZone | null = null;
    if (session.zoneId != null) {
      zone = await this.zonesRepository.findOneBy({ id: session.zoneId });
    }
    const allowed: PersonType[] | null = zone?.allowedPersonTypes?.length
      ? zone.allowedPersonTypes
      : null;

    const upserts: SnapshotEntry[] = upsertAssignments
      .filter((assignment) => !allowed || allowed.includes(assignment.participant.type))
      .map((assignment) => ({
        assignmentId: assignment.id,
        code: assignment.badge.code,
        firstName: assignment.participant.firstName,
        lastName: assignment.participant.lastName,
        personType: assignment.participant.type,
        version: assignment.version,
      }));

    return {
      version: await this.currentMetaVersion(),
      upserts,
      requiresOnlineValidation:
        (zone?.requiresOnlineValidation ?? false) || (await this.expectedOnline(session.zoneId)),
      revokedAssignmentIds: revoked.map((assignment) => assignment.id),
    };
  }

  async close(sessionId: number, userId: number) {
    const session = await this.findOwnedSession(sessionId, userId);
    if (session.closedAt) return { closed: true, closedAt: session.closedAt };
    session.closedAt = new Date();
    const saved = await this.sessionsRepository.save(session);
    await this.auditService.record({
      userId,
      action: AccessAuditAction.SCAN_SESSION_CLOSED,
      entityType: 'access_scan_sessions',
      entityId: session.id,
      details: null,
    });
    return { closed: true, closedAt: saved.closedAt };
  }

  /** Collection-only: expiration must not destroy unsent offline evidence.
   * This grants no new snapshot, key, lookup or scan permission.
   */
  async findOwnedSession(sessionId: number, userId: number): Promise<AccessScanSession> {
    const session = await this.sessionsRepository.findOneBy({ id: sessionId });
    if (!session || session.userId !== userId) throw new NotFoundException('Session introuvable');
    return session;
  }

  /** Utilisé par le service de scans pour rattacher les événements. */
  async findOpenSession(sessionId: number, userId: number): Promise<AccessScanSession> {
    return this.requireOpenSession(sessionId, userId);
  }
}
