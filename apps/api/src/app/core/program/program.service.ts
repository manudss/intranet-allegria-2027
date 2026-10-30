import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  ProgramChangeLog,
  ProgramChangeLogAction,
  ProgramDocumentLink,
  ProgramSequence,
  ProgramSequenceStatus,
} from '../entities';
import { ProgramRecalcService } from './program-recalc.service';
import { computeEndTime, minutesToTime, timeToMinutes } from './program-time.util';
import {
  ProgramInsertPreview,
  ProgramResizePreview,
  ProgramSequenceData,
  ProgramSequenceDiff,
  ProgramSequenceDraft,
} from './program-recalc.types';
import {
  ChangeLogQueryDto,
  CreateSequenceDto,
  InsertSequenceDto,
  ProgramChangeLogView,
  ProgramRequestUser,
  ProgramSequenceView,
  ResizeSequenceDto,
  UpdateSequenceDto,
} from './program.types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DURATION_MINUTES = 1440;
const MAX_TITLE_LENGTH = 200;
const MAX_LOCATION_LENGTH = 150;
const MAX_DOCUMENT_LINKS = 20;

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function toData(sequence: ProgramSequence): ProgramSequenceData {
  return {
    id: sequence.id,
    eventDate: sequence.eventDate,
    location: sequence.location,
    title: sequence.title,
    startTime: sequence.startTime,
    durationMinutes: sequence.durationMinutes,
    endTime: sequence.endTime,
    status: sequence.status,
    minDurationMinutes: sequence.minDurationMinutes,
    minMarginMinutes: sequence.minMarginMinutes,
    previousSequenceId: sequence.previousSequenceId,
    anchorSequenceId: sequence.anchorSequenceId,
    volunteerTeamId: sequence.volunteerTeamId,
    notes: sequence.notes,
  };
}

function toView(sequence: ProgramSequence): ProgramSequenceView {
  return {
    ...toData(sequence),
    volunteerTeamName: sequence.volunteerTeam?.name ?? null,
    missionIds: sequence.missionIds ?? [],
    documentLinks: sequence.documentLinks ?? [],
    frozenByUserId: sequence.frozenByUserId,
    frozenByUserName: sequence.frozenByUser?.email ?? null,
    frozenAt: sequence.frozenAt ? new Date(sequence.frozenAt).toISOString() : null,
  };
}

function toLogView(log: ProgramChangeLog): ProgramChangeLogView {
  return {
    id: log.id,
    action: log.action,
    eventDate: log.eventDate,
    authorUserId: log.authorUserId,
    authorUserName: log.authorUser?.email ?? null,
    createdAt: new Date(log.createdAt).toISOString(),
    affectedSequenceIds: log.affectedSequenceIds,
    beforeSnapshot: log.beforeSnapshot,
    afterSnapshot: log.afterSnapshot,
    comment: log.comment,
  };
}

/** Empreinte de l'état d'une chaîne, pour détecter une modification concurrente entre aperçu et application. */
export function chainVersion(chain: ProgramSequenceData[]): string {
  const state = chain
    .map((s) => `${s.id}:${s.startTime}:${s.durationMinutes}:${s.status}:${s.previousSequenceId}`)
    .join('|');
  return createHash('sha1').update(state).digest('hex').slice(0, 16);
}

function snapshotOf(diffs: ProgramSequenceDiff[], side: 'before' | 'after') {
  return Object.fromEntries(diffs.map((d) => [String(d.sequenceId), d[side]]));
}

@Injectable()
export class ProgramService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly recalc: ProgramRecalcService,
  ) {}

  /** Toutes les séquences d'un jour (tous lieux, branches incluses). */
  async getDay(date: string): Promise<{ date: string; sequences: ProgramSequenceView[] }> {
    this.assertDate(date);
    const sequences = await this.dataSource.manager.find(ProgramSequence, {
      where: { eventDate: date },
      relations: { volunteerTeam: true, frozenByUser: true },
      order: { location: 'ASC', startTime: 'ASC', id: 'ASC' },
    });
    return { date, sequences: sequences.map(toView) };
  }

  async previewInsert(
    afterSequenceId: number,
    dto: InsertSequenceDto,
  ): Promise<ProgramInsertPreview & { version: string }> {
    const { chain, preview } = await this.computeInsert(
      this.dataSource.manager,
      afterSequenceId,
      dto,
    );
    return { ...preview, version: chainVersion(chain) };
  }

  async applyInsert(
    user: ProgramRequestUser,
    afterSequenceId: number,
    dto: InsertSequenceDto,
    version: string,
  ): Promise<{ sequence: ProgramSequenceView; affected: ProgramSequenceDiff[] }> {
    return this.dataSource.transaction(async (manager) => {
      const { chain, preview } = await this.computeInsert(manager, afterSequenceId, dto, true);
      this.assertApplicable(chain, preview.outcome, version);
      if (preview.outcome !== 'ok') {
        throw new BadRequestException(preview.message);
      }

      const { followingSequenceId } = this.recalc.applyInsert(chain, preview);
      for (const diff of preview.affected) {
        await this.persistTiming(manager, diff);
      }

      const created = await manager.save(
        manager.create(ProgramSequence, {
          ...preview.newSequence,
          missionIds: [],
          documentLinks: [],
          frozenByUserId: null,
          frozenAt: null,
        }),
      );
      if (followingSequenceId !== null) {
        await manager.update(ProgramSequence, followingSequenceId, {
          previousSequenceId: created.id,
        });
      }

      await this.writeLog(manager, {
        action: ProgramChangeLogAction.INSERT,
        user,
        eventDate: created.eventDate,
        affectedSequenceIds: [created.id, ...preview.affected.map((d) => d.sequenceId)],
        before: snapshotOf(preview.affected, 'before'),
        after: {
          ...snapshotOf(preview.affected, 'after'),
          [String(created.id)]: {
            startTime: created.startTime,
            endTime: created.endTime,
            durationMinutes: created.durationMinutes,
          },
        },
        comment: preview.message,
      });

      return { sequence: toView(created), affected: preview.affected };
    });
  }

  async previewResize(
    sequenceId: number,
    dto: ResizeSequenceDto,
  ): Promise<ProgramResizePreview & { version: string }> {
    const { chain, preview } = await this.computeResize(this.dataSource.manager, sequenceId, dto);
    return { ...preview, version: chainVersion(chain) };
  }

  async applyResize(
    user: ProgramRequestUser,
    sequenceId: number,
    dto: ResizeSequenceDto,
    version: string,
  ): Promise<{ affected: ProgramSequenceDiff[] }> {
    return this.dataSource.transaction(async (manager) => {
      const { chain, preview, eventDate } = await this.computeResize(
        manager,
        sequenceId,
        dto,
        true,
      );
      this.assertApplicable(chain, preview.outcome, version);
      if (preview.outcome !== 'ok') {
        throw new BadRequestException(preview.message);
      }

      const target = chain.find((s) => s.id === sequenceId) as ProgramSequenceData;
      const resizedTarget: ProgramSequenceDiff = {
        sequenceId,
        title: target.title,
        before: {
          startTime: target.startTime,
          endTime: target.endTime,
          durationMinutes: target.durationMinutes,
        },
        after: {
          startTime: target.startTime,
          endTime: computeEndTime(target.startTime, preview.newDurationMinutes),
          durationMinutes: preview.newDurationMinutes,
        },
      };
      const diffs = [resizedTarget, ...preview.affected];
      for (const diff of diffs) {
        await this.persistTiming(manager, diff);
      }

      await this.writeLog(manager, {
        action: ProgramChangeLogAction.RESIZE,
        user,
        eventDate,
        affectedSequenceIds: diffs.map((d) => d.sequenceId),
        before: snapshotOf(diffs, 'before'),
        after: snapshotOf(diffs, 'after'),
        comment: preview.message,
      });

      return { affected: diffs };
    });
  }

  async freeze(user: ProgramRequestUser, sequenceId: number): Promise<ProgramSequenceView> {
    return this.setFrozen(user, sequenceId, true);
  }

  async unfreeze(user: ProgramRequestUser, sequenceId: number): Promise<ProgramSequenceView> {
    return this.setFrozen(user, sequenceId, false);
  }

  /** Crée la première séquence d'un jour/lieu vide, ou la tête d'une branche rattachée à un repère. */
  async createSequence(
    user: ProgramRequestUser,
    dto: CreateSequenceDto,
  ): Promise<ProgramSequenceView> {
    this.assertDate(dto.eventDate);
    this.assertDuration(dto.durationMinutes);
    this.assertTitle(dto.title);
    const location = dto.location?.trim();
    if (!location || location.length > MAX_LOCATION_LENGTH) {
      throw new BadRequestException(`Le lieu est obligatoire (${MAX_LOCATION_LENGTH} car. max).`);
    }
    if (!TIME_PATTERN.test(dto.startTime ?? '')) {
      throw new BadRequestException("Heure de début invalide, format attendu : HH:mm.");
    }
    const patch = this.validateMetadata(dto);

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.find(ProgramSequence, {
        where: { eventDate: dto.eventDate, location },
      });
      if (existing.length) {
        throw new ConflictException(
          'Ce lieu contient déjà des séquences : utilisez « Insérer après ».',
        );
      }
      let anchorSequenceId: number | null = null;
      if (dto.anchorSequenceId != null) {
        const anchor = await this.loadSequence(manager, dto.anchorSequenceId);
        if (anchor.eventDate !== dto.eventDate || anchor.anchorSequenceId !== null) {
          throw new BadRequestException(
            'Le repère doit être une séquence principale du même jour.',
          );
        }
        anchorSequenceId = anchor.id;
      }

      const created = await manager.save(
        manager.create(ProgramSequence, {
          eventDate: dto.eventDate,
          location,
          title: dto.title.trim(),
          startTime: dto.startTime,
          durationMinutes: dto.durationMinutes,
          endTime: computeEndTime(dto.startTime, dto.durationMinutes),
          status: ProgramSequenceStatus.MOBILE,
          previousSequenceId: null,
          anchorSequenceId,
          missionIds: [],
          documentLinks: [],
          notes: null,
          volunteerTeamId: null,
          minDurationMinutes: null,
          minMarginMinutes: null,
          frozenByUserId: null,
          frozenAt: null,
          ...patch,
        }),
      );

      await this.writeLog(manager, {
        action: ProgramChangeLogAction.INSERT,
        user,
        eventDate: created.eventDate,
        affectedSequenceIds: [created.id],
        before: null,
        after: {
          [String(created.id)]: {
            startTime: created.startTime,
            endTime: created.endTime,
            durationMinutes: created.durationMinutes,
          },
        },
        comment: `Création de « ${created.title} » (${created.location}).`,
      });
      return toView(created);
    });
  }

  /** Édite les champs descriptifs (titre, notes, équipe, liens…) ; les horaires passent par resize/insert. */
  async updateSequence(
    user: ProgramRequestUser,
    sequenceId: number,
    dto: UpdateSequenceDto,
  ): Promise<ProgramSequenceView> {
    const patch = this.validateMetadata(dto);
    if (dto.title !== undefined) {
      this.assertTitle(dto.title);
      patch.title = dto.title.trim();
    }
    if (!Object.keys(patch).length) {
      throw new BadRequestException('Aucune modification à appliquer.');
    }

    return this.dataSource.transaction(async (manager) => {
      const sequence = await this.loadSequence(manager, sequenceId);
      const before: Record<string, unknown> = {};
      for (const key of Object.keys(patch)) {
        before[key] = (sequence as unknown as Record<string, unknown>)[key];
      }
      await manager.update(ProgramSequence, sequenceId, patch);

      await this.writeLog(manager, {
        action: ProgramChangeLogAction.UPDATE,
        user,
        eventDate: sequence.eventDate,
        affectedSequenceIds: [sequenceId],
        before,
        after: { ...patch },
        comment: `Modification de « ${sequence.title} » : ${Object.keys(patch).join(', ')}.`,
      });

      const refreshed = await manager.findOneOrFail(ProgramSequence, {
        where: { id: sequenceId },
        relations: { volunteerTeam: true, frozenByUser: true },
      });
      return toView(refreshed);
    });
  }

  /**
   * Supprime une séquence mobile et reconnecte la suivante. Avec `closeGap`, les séquences
   * suivantes de la chaîne sont avancées pour combler le trou (refusé si l'une est figée).
   */
  async deleteSequence(
    user: ProgramRequestUser,
    sequenceId: number,
    options: { closeGap?: boolean } = {},
  ): Promise<{ deletedId: number; shiftedMinutes: number }> {
    return this.dataSource.transaction(async (manager) => {
      const sequence = await this.loadSequence(manager, sequenceId);
      if (sequence.status === ProgramSequenceStatus.FROZEN) {
        throw new ConflictException('Une séquence figée ne peut pas être supprimée : défigez-la.');
      }
      const branches = await manager.find(ProgramSequence, {
        where: { anchorSequenceId: sequenceId },
      });
      if (branches.length) {
        throw new ConflictException(
          'Des branches parallèles sont rattachées à cette séquence : supprimez-les d’abord.',
        );
      }

      const siblings = await manager.find(ProgramSequence, {
        where: { eventDate: sequence.eventDate, location: sequence.location },
      });
      const next = siblings.find((s) => s.previousSequenceId === sequenceId);

      // Séquences à avancer (toute la queue de chaîne) et décalage, calculés avant toute écriture.
      const tail: ProgramSequence[] = [];
      let shift = 0;
      if (options.closeGap && next) {
        const predecessor = siblings.find((s) => s.id === sequence.previousSequenceId);
        const newStart = predecessor ? predecessor.endTime : sequence.startTime;
        shift = Math.max(0, timeToMinutes(next.startTime) - timeToMinutes(newStart));
        for (let cursor: ProgramSequence | undefined = next; cursor; ) {
          tail.push(cursor);
          const current: ProgramSequence = cursor;
          cursor = siblings.find((s) => s.previousSequenceId === current.id);
        }
        if (shift > 0 && tail.some((s) => s.status === ProgramSequenceStatus.FROZEN)) {
          throw new ConflictException(
            'Une séquence figée suit : impossible de combler le trou, défigez-la ou supprimez sans combler.',
          );
        }
      }

      if (next) {
        await manager.update(ProgramSequence, next.id, {
          previousSequenceId: sequence.previousSequenceId,
        });
      }
      await manager.delete(ProgramSequence, sequenceId);
      if (shift > 0) {
        for (const item of tail) {
          const startTime = minutesToTime(timeToMinutes(item.startTime) - shift);
          await manager.update(ProgramSequence, item.id, {
            startTime,
            endTime: computeEndTime(startTime, item.durationMinutes),
          });
        }
      }

      await this.writeLog(manager, {
        action: ProgramChangeLogAction.DELETE,
        user,
        eventDate: sequence.eventDate,
        affectedSequenceIds: [sequenceId, ...(shift > 0 ? tail : next ? [next] : []).map((s) => s.id)],
        before: {
          [String(sequenceId)]: {
            title: sequence.title,
            location: sequence.location,
            startTime: sequence.startTime,
            endTime: sequence.endTime,
            durationMinutes: sequence.durationMinutes,
          },
        },
        after: null,
        comment:
          shift > 0
            ? `Suppression de « ${sequence.title} » ; ${tail.length} séquence(s) avancée(s) de ${shift} min.`
            : `Suppression de « ${sequence.title} ».`,
      });
      return { deletedId: sequenceId, shiftedMinutes: shift };
    });
  }

  async getChangeLog(query: ChangeLogQueryDto): Promise<ProgramChangeLogView[]> {
    if (query.date !== undefined) {
      this.assertDate(query.date);
    }
    const logs = await this.dataSource.manager.find(ProgramChangeLog, {
      where: query.date ? { eventDate: query.date } : {},
      relations: { authorUser: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 200,
    });
    return logs.map(toLogView);
  }

  private async setFrozen(
    user: ProgramRequestUser,
    sequenceId: number,
    frozen: boolean,
  ): Promise<ProgramSequenceView> {
    return this.dataSource.transaction(async (manager) => {
      const sequence = await this.loadSequence(manager, sequenceId);
      const isFrozen = sequence.status === ProgramSequenceStatus.FROZEN;
      if (isFrozen === frozen) {
        throw new ConflictException(
          frozen ? 'Cette séquence est déjà figée.' : "Cette séquence n'est pas figée.",
        );
      }

      const before = { status: sequence.status, frozenByUserId: sequence.frozenByUserId };
      await manager.update(ProgramSequence, sequenceId, {
        status: frozen ? ProgramSequenceStatus.FROZEN : ProgramSequenceStatus.MOBILE,
        frozenByUserId: frozen ? user.id : null,
        frozenAt: frozen ? new Date() : null,
      });

      await this.writeLog(manager, {
        action: frozen ? ProgramChangeLogAction.FREEZE : ProgramChangeLogAction.UNFREEZE,
        user,
        eventDate: sequence.eventDate,
        affectedSequenceIds: [sequenceId],
        before,
        after: {
          status: frozen ? ProgramSequenceStatus.FROZEN : ProgramSequenceStatus.MOBILE,
          frozenByUserId: frozen ? user.id : null,
        },
        comment: null,
      });

      const refreshed = await manager.findOneOrFail(ProgramSequence, {
        where: { id: sequenceId },
        relations: { volunteerTeam: true, frozenByUser: true },
      });
      return toView(refreshed);
    });
  }

  private async computeInsert(
    manager: EntityManager,
    afterSequenceId: number,
    dto: InsertSequenceDto,
    lock = false,
  ) {
    const anchor = await this.loadSequence(manager, afterSequenceId);
    this.assertDuration(dto.durationMinutes);
    if (!dto.title?.trim()) {
      throw new BadRequestException('Le titre est obligatoire.');
    }
    const chain = await this.loadChain(manager, anchor.eventDate, anchor.location, lock);
    const draft: ProgramSequenceDraft = {
      eventDate: anchor.eventDate,
      location: anchor.location,
      title: dto.title.trim(),
      durationMinutes: dto.durationMinutes,
      volunteerTeamId: dto.volunteerTeamId ?? null,
      notes: dto.notes ?? null,
      minDurationMinutes: dto.minDurationMinutes ?? null,
      minMarginMinutes: dto.minMarginMinutes ?? null,
    };
    return { chain, preview: this.recalc.previewInsert(chain, afterSequenceId, draft) };
  }

  private async computeResize(
    manager: EntityManager,
    sequenceId: number,
    dto: ResizeSequenceDto,
    lock = false,
  ) {
    const target = await this.loadSequence(manager, sequenceId);
    this.assertDuration(dto.durationMinutes);
    if (target.status === ProgramSequenceStatus.FROZEN) {
      throw new ConflictException('Une séquence figée ne peut pas être redimensionnée.');
    }
    const chain = await this.loadChain(manager, target.eventDate, target.location, lock);
    return {
      chain,
      eventDate: target.eventDate,
      preview: this.recalc.previewResize(chain, sequenceId, dto.durationMinutes),
    };
  }

  private assertApplicable(chain: ProgramSequenceData[], outcome: string, version: string) {
    if (!version || version !== chainVersion(chain)) {
      throw new ConflictException(
        'Le programme a été modifié depuis l’aperçu. Relancez la simulation.',
      );
    }
    if (outcome === 'impossible') {
      throw new BadRequestException('Application impossible sans décision manuelle.');
    }
  }

  private async loadSequence(manager: EntityManager, id: number): Promise<ProgramSequence> {
    const sequence = await manager.findOne(ProgramSequence, { where: { id } });
    if (!sequence) {
      throw new NotFoundException(`Séquence ${id} introuvable`);
    }
    return sequence;
  }

  private async loadChain(
    manager: EntityManager,
    eventDate: string,
    location: string,
    lock: boolean,
  ): Promise<ProgramSequenceData[]> {
    const sequences = await manager.find(ProgramSequence, {
      where: { eventDate, location },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    return this.recalc.buildChain(sequences.map(toData), eventDate, location);
  }

  private persistTiming(manager: EntityManager, diff: ProgramSequenceDiff) {
    return manager.update(ProgramSequence, diff.sequenceId, {
      startTime: diff.after.startTime,
      durationMinutes: diff.after.durationMinutes,
      endTime: diff.after.endTime,
    });
  }

  private writeLog(
    manager: EntityManager,
    entry: {
      action: ProgramChangeLogAction;
      user: ProgramRequestUser;
      eventDate: string;
      affectedSequenceIds: number[];
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
      comment: string | null;
    },
  ) {
    return manager.save(
      manager.create(ProgramChangeLog, {
        action: entry.action,
        authorUserId: entry.user.id,
        eventDate: entry.eventDate,
        affectedSequenceIds: entry.affectedSequenceIds,
        beforeSnapshot: entry.before,
        afterSnapshot: entry.after,
        comment: entry.comment,
      }),
    );
  }

  private assertTitle(title: string | undefined) {
    const trimmed = title?.trim();
    if (!trimmed || trimmed.length > MAX_TITLE_LENGTH) {
      throw new BadRequestException(`Le titre est obligatoire (${MAX_TITLE_LENGTH} car. max).`);
    }
  }

  /** Valide et normalise les champs descriptifs communs (création / édition) ; ignore ceux non fournis. */
  private validateMetadata(dto: {
    notes?: string | null;
    volunteerTeamId?: number | null;
    minDurationMinutes?: number | null;
    minMarginMinutes?: number | null;
    missionIds?: number[];
    documentLinks?: ProgramDocumentLink[];
  }): Partial<ProgramSequence> {
    const patch: Partial<ProgramSequence> = {};
    if (dto.notes !== undefined) {
      patch.notes = dto.notes?.trim() ? dto.notes.trim() : null;
    }
    if (dto.volunteerTeamId !== undefined) {
      this.assertOptionalInt(dto.volunteerTeamId, 'L’équipe', 1);
      patch.volunteerTeamId = dto.volunteerTeamId;
    }
    if (dto.minDurationMinutes !== undefined) {
      this.assertOptionalInt(dto.minDurationMinutes, 'La durée minimale', 0, MAX_DURATION_MINUTES);
      patch.minDurationMinutes = dto.minDurationMinutes;
    }
    if (dto.minMarginMinutes !== undefined) {
      this.assertOptionalInt(dto.minMarginMinutes, 'La marge minimale', 0, MAX_DURATION_MINUTES);
      patch.minMarginMinutes = dto.minMarginMinutes;
    }
    if (dto.missionIds !== undefined) {
      if (!Array.isArray(dto.missionIds) || !dto.missionIds.every((id) => Number.isInteger(id) && id > 0)) {
        throw new BadRequestException('Liste de missions invalide.');
      }
      patch.missionIds = [...new Set(dto.missionIds)];
    }
    if (dto.documentLinks !== undefined) {
      patch.documentLinks = this.normalizeLinks(dto.documentLinks);
    }
    return patch;
  }

  private assertOptionalInt(value: number | null, label: string, min: number, max?: number) {
    if (value === null) return;
    if (!Number.isInteger(value) || value < min || (max !== undefined && value > max)) {
      throw new BadRequestException(`${label} est invalide.`);
    }
  }

  private normalizeLinks(links: ProgramDocumentLink[]): ProgramDocumentLink[] {
    if (!Array.isArray(links) || links.length > MAX_DOCUMENT_LINKS) {
      throw new BadRequestException(`Au plus ${MAX_DOCUMENT_LINKS} liens documentaires.`);
    }
    return links.map((link) => {
      const label = link?.label?.trim();
      const url = link?.url?.trim();
      if (!label || label.length > 100 || !url || !isHttpUrl(url)) {
        throw new BadRequestException(
          'Chaque lien doit avoir un libellé (100 car. max) et une URL http(s) valide.',
        );
      }
      return { label, url };
    });
  }

  private assertDate(date: string) {
    if (!DATE_PATTERN.test(date)) {
      throw new BadRequestException('Date invalide, format attendu : YYYY-MM-DD.');
    }
  }

  private assertDuration(durationMinutes: number) {
    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > MAX_DURATION_MINUTES
    ) {
      throw new BadRequestException(
        `La durée doit être un entier entre 1 et ${MAX_DURATION_MINUTES} minutes.`,
      );
    }
  }
}
