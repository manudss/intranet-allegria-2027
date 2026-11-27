import { ProgramMissionTimingService, ShiftTimingDiff } from './program-mission-timing.service';
import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  EventPreparationTask,
  Group,
  ProgramChangeLog,
  ProgramChangeLogAction,
  ProgramDocumentLink,
  ProgramSequence,
  ProgramSequenceGroup,
  ProgramSequenceStatus,
  ProgramSequenceTrack,
  ProgramPublicExport,
  ProgramSequenceVisibility,
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
  CreateTaskDto,
  EventTaskView,
  InsertSequenceDto,
  ProgramChangeLogView,
  ProgramRequestUser,
  ProgramSequenceDayView,
  ProgramSequenceDetailView,
  ProgramSequenceView,
  ResizeSequenceDto,
  SetSequenceGroupsDto,
  UpdateSequenceDto,
  UpdateTaskDto,
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
    track: sequence.track ?? ProgramSequenceTrack.COMMON,
    visibility: sequence.visibility ?? ProgramSequenceVisibility.INTERNAL,
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
    visibility: sequence.visibility ?? ProgramSequenceVisibility.INTERNAL,
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
    @Optional() private readonly missionTiming?: ProgramMissionTimingService,
  ) {}

  private async timingVersion(manager: EntityManager, chain: ProgramSequenceData[]) {
    return (
      chainVersion(chain) +
      (this.missionTiming ? ':' + (await this.missionTiming.version(manager)) : '')
    );
  }
  private linkedOutcome(linked?: { conflicts: string[] }) {
    return linked?.conflicts.length
      ? { outcome: 'impossible' as const, message: linked.conflicts.join(' ') }
      : {};
  }
  private assertLinked(linked?: { conflicts: string[] }) {
    if (linked?.conflicts.length) throw new ConflictException(linked.conflicts.join(' '));
  }
  private resizeDiffs(
    chain: ProgramSequenceData[],
    sequenceId: number,
    preview: ProgramResizePreview,
  ): ProgramSequenceDiff[] {
    const target = chain.find((s) => s.id === sequenceId)!;
    return [
      {
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
      },
      ...preview.affected,
    ];
  }

  /** Toutes les séquences d'un jour (tous lieux, branches incluses). */
  async getDay(date: string): Promise<{ date: string; sequences: ProgramSequenceDayView[] }> {
    this.assertDate(date);
    const sequences = await this.dataSource.manager.find(ProgramSequence, {
      where: { eventDate: date },
      relations: { volunteerTeam: true, frozenByUser: true },
      order: { location: 'ASC', startTime: 'ASC', id: 'ASC' },
    });
    const ids = sequences.map((sequence) => sequence.id);
    const links = ids.length
      ? await this.dataSource.manager.find(ProgramSequenceGroup, {
          where: { sequenceId: In(ids) },
          order: { groupId: 'ASC' },
        })
      : [];
    const groupIdsBySequence = new Map<number, number[]>();
    for (const link of links) {
      groupIdsBySequence.set(link.sequenceId, [
        ...(groupIdsBySequence.get(link.sequenceId) ?? []),
        link.groupId,
      ]);
    }
    const gatheringIdsBySequence = await this.gatheringRepartitionIdsBySequence(ids);
    return {
      date,
      sequences: sequences.map((sequence) => ({
        ...toView(sequence),
        groupIds: groupIdsBySequence.get(sequence.id) ?? [],
        gatheringRepartitionIds: gatheringIdsBySequence.get(sequence.id) ?? [],
      })),
    };
  }

  /** Répartitions de groupes de rassemblement rattachées aux séquences données. */
  private async gatheringRepartitionIdsBySequence(
    sequenceIds: number[],
  ): Promise<Map<number, number[]>> {
    const out = new Map<number, number[]>();
    if (!sequenceIds.length) return out;
    const rows: { program_sequence_id: number; id: number }[] = await this.dataSource.query(
      `SELECT program_sequence_id, id FROM gathering_repartitions
        WHERE program_sequence_id = ANY($1::int[]) ORDER BY id`,
      [sequenceIds],
    );
    for (const row of rows) {
      out.set(row.program_sequence_id, [...(out.get(row.program_sequence_id) ?? []), row.id]);
    }
    return out;
  }

  async previewInsert(
    afterSequenceId: number,
    dto: InsertSequenceDto,
  ): Promise<ProgramInsertPreview & { version: string; shiftChanges?: ShiftTimingDiff[] }> {
    return this.dataSource.transaction(async (manager) => {
      await this.missionTiming?.lock(manager);
      const { chain, preview } = await this.computeInsert(manager, afterSequenceId, dto);
      const linked = await this.missionTiming?.plan(
        manager,
        preview.newSequence.eventDate,
        preview.affected,
      );
      return {
        ...preview,
        ...this.linkedOutcome(linked),
        version: await this.timingVersion(manager, chain),
        shiftChanges: linked?.shifts ?? [],
      };
    });
  }

  async applyInsert(
    user: ProgramRequestUser,
    afterSequenceId: number,
    dto: InsertSequenceDto,
    version: string,
  ): Promise<{ sequence: ProgramSequenceView; affected: ProgramSequenceDiff[] }> {
    return this.dataSource.transaction(async (manager) => {
      await this.missionTiming?.lock(manager);
      const { chain, preview } = await this.computeInsert(manager, afterSequenceId, dto, true);
      if (version !== (await this.timingVersion(manager, chain)))
        throw new ConflictException("L'aperçu a changé. Prévisualiser à nouveau.");
      this.assertApplicable(chain, preview.outcome, chainVersion(chain));
      if (preview.outcome !== 'ok') {
        throw new BadRequestException(preview.message);
      }

      const linked = await this.missionTiming?.plan(
        manager,
        preview.newSequence.eventDate,
        preview.affected,
      );
      this.assertLinked(linked);
      if (linked) await this.missionTiming?.apply(manager, linked.shifts);
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
  ): Promise<ProgramResizePreview & { version: string; shiftChanges?: ShiftTimingDiff[] }> {
    return this.dataSource.transaction(async (manager) => {
      await this.missionTiming?.lock(manager);
      const { chain, preview, eventDate } = await this.computeResize(manager, sequenceId, dto);
      const diffs = this.resizeDiffs(chain, sequenceId, preview);
      const linked = await this.missionTiming?.plan(manager, eventDate, diffs);
      return {
        ...preview,
        ...this.linkedOutcome(linked),
        version: await this.timingVersion(manager, chain),
        shiftChanges: linked?.shifts ?? [],
      };
    });
  }

  async applyResize(
    user: ProgramRequestUser,
    sequenceId: number,
    dto: ResizeSequenceDto,
    version: string,
  ): Promise<{ affected: ProgramSequenceDiff[] }> {
    return this.dataSource.transaction(async (manager) => {
      await this.missionTiming?.lock(manager);
      const { chain, preview, eventDate } = await this.computeResize(
        manager,
        sequenceId,
        dto,
        true,
      );
      if (version !== (await this.timingVersion(manager, chain)))
        throw new ConflictException("L'aperçu a changé. Prévisualiser à nouveau.");
      this.assertApplicable(chain, preview.outcome, chainVersion(chain));
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
      const linked = await this.missionTiming?.plan(manager, eventDate, diffs);
      this.assertLinked(linked);
      if (linked) await this.missionTiming?.apply(manager, linked.shifts);
      for (const diff of diffs) {
        await this.persistTiming(manager, diff);
      }

      await this.writeLog(manager, {
        action: ProgramChangeLogAction.RESIZE,
        user,
        eventDate,
        affectedSequenceIds: diffs.map((d) => d.sequenceId),
        before: snapshotOf(diffs, 'before'),
        after: { events: snapshotOf(diffs, 'after'), shifts: linked?.shifts ?? [] },
        comment: preview.message,
      });

      return { affected: diffs };
    });
  }

  private async computeBatch(
    manager: EntityManager,
    targets: { id: number; durationMinutes: number }[],
  ) {
    if (
      !Array.isArray(targets) ||
      !targets.length ||
      targets.length > 2 ||
      new Set(targets.map((t) => t.id)).size !== targets.length
    )
      throw new BadRequestException('Choisir un ou deux créneaux distincts.');
    const all: ProgramSequenceDiff[] = [];
    let first: ProgramResizePreview | null = null;
    let eventDate = '';
    for (const t of targets) {
      if (!Number.isInteger(t.id) || t.id <= 0)
        throw new BadRequestException('Identifiant invalide.');
      const r = await this.computeResize(
        manager,
        t.id,
        { durationMinutes: t.durationMinutes },
        true,
      );
      if (r.preview.outcome !== 'ok') throw new ConflictException(r.preview.message);
      if (eventDate && eventDate !== r.eventDate)
        throw new BadRequestException('Les voies doivent être du même jour.');
      eventDate = r.eventDate;
      first ??= r.preview;
      const diffs = this.resizeDiffs(r.chain, t.id, r.preview);
      if (diffs.some((d) => all.some((a) => a.sequenceId === d.sequenceId)))
        throw new ConflictException(
          'Les recalculs se recouvrent : prévisualiser une opération à la fois.',
        );
      all.push(...diffs);
    }
    const linked = await this.missionTiming?.plan(manager, eventDate, all);
    return { all, first: first!, eventDate, linked };
  }
  async previewResizeBatch(targets: { id: number; durationMinutes: number }[]) {
    return this.dataSource.transaction(async (manager) => {
      await this.missionTiming?.lock(manager);
      const r = await this.computeBatch(manager, targets);
      return {
        ...r.first,
        affected: r.all.slice(1),
        ...this.linkedOutcome(r.linked),
        shiftChanges: r.linked?.shifts ?? [],
        version: await this.missionTiming!.version(manager),
      };
    });
  }
  async applyResizeBatch(
    user: ProgramRequestUser,
    targets: { id: number; durationMinutes: number }[],
    version: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.missionTiming?.lock(manager);
      if ((await this.missionTiming!.version(manager)) !== version)
        throw new ConflictException("L'aperçu a changé. Prévisualiser à nouveau.");
      const r = await this.computeBatch(manager, targets);
      this.assertLinked(r.linked);
      if (r.linked) await this.missionTiming?.apply(manager, r.linked.shifts);
      for (const diff of r.all) await this.persistTiming(manager, diff);
      await this.writeLog(manager, {
        action: ProgramChangeLogAction.RESIZE,
        user,
        eventDate: r.eventDate,
        affectedSequenceIds: r.all.map((d) => d.sequenceId),
        before: snapshotOf(r.all, 'before'),
        after: { events: snapshotOf(r.all, 'after'), shifts: r.linked?.shifts ?? [] },
        comment: 'Recalcul commun des voies et créneaux bénévoles.',
      });
      return { affected: r.all };
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
      throw new BadRequestException('Heure de début invalide, format attendu : HH:mm.');
    }
    const patch = this.validateMetadata(dto);

    return this.dataSource.transaction(async (manager) => {
      await this.missionTiming?.lock(manager);
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
          track: ProgramSequenceTrack.COMMON,
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
      await this.missionTiming?.lock(manager);
      const sequence = await this.loadSequence(manager, sequenceId);
      if (dto.missionIds)
        await this.missionTiming?.assertMembership(manager, sequenceId, dto.missionIds);
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
      await this.missionTiming?.lock(manager);
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
      if (this.missionTiming) {
        const ids = options.closeGap ? siblings.map((s) => s.id) : [sequenceId];
        const bound = await manager.query(
          'SELECT shift_id FROM program_shift_bindings WHERE sequence_id=ANY($1::int[]) LIMIT 1',
          [ids],
        );
        if (bound.length)
          throw new ConflictException(
            'Des horaires bénévoles sont pilotés dans cette chaîne. Retirer explicitement leur pilotage avant cette suppression.',
          );
      }

      // Séquences à avancer (toute la queue de chaîne) et décalage, calculés avant toute écriture.
      const tail: ProgramSequence[] = [];
      let shift = 0;
      if (options.closeGap && next) {
        const predecessor = siblings.find((s) => s.id === sequence.previousSequenceId);
        const newStart = predecessor ? predecessor.endTime : sequence.startTime;
        shift = Math.max(0, timeToMinutes(next.startTime) - timeToMinutes(newStart));
        for (let cursor: ProgramSequence | undefined = next; cursor;) {
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
        affectedSequenceIds: [
          sequenceId,
          ...(shift > 0 ? tail : next ? [next] : []).map((s) => s.id),
        ],
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
    if (query.sequenceId !== undefined) {
      const sequenceId = Number(query.sequenceId);
      if (!Number.isInteger(sequenceId) || sequenceId <= 0) {
        throw new BadRequestException('sequenceId invalide.');
      }
      const qb = this.dataSource.manager
        .getRepository(ProgramChangeLog)
        .createQueryBuilder('log')
        .leftJoinAndSelect('log.authorUser', 'authorUser')
        .where('"log"."affectedSequenceIds" @> CAST(:seq AS jsonb)', {
          seq: JSON.stringify([sequenceId]),
        })
        .orderBy('log.createdAt', 'DESC')
        .addOrderBy('log.id', 'DESC')
        .take(200);
      if (query.date) {
        qb.andWhere('log.eventDate = :date', { date: query.date });
      }
      const logs = await qb.getMany();
      return logs.map(toLogView);
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
      await this.missionTiming?.lock(manager);
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
      track: this.assertTrack(dto.track),
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
    if (dto.durationMinutes < (target.minDurationMinutes ?? 1)) {
      throw new BadRequestException(
        `La durée minimale de cette séquence est de ${target.minDurationMinutes ?? 1} min.`,
      );
    }
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

  // ── Fiche événement ─────────────────────────────────────────────────────

  /** Détail complet d'une séquence pour la fiche : groupes de rassemblement liés inclus. */
  async getSequenceDetail(sequenceId: number): Promise<ProgramSequenceDetailView> {
    const sequence = await this.dataSource.manager.findOne(ProgramSequence, {
      where: { id: sequenceId },
      relations: { volunteerTeam: true, frozenByUser: true },
    });
    if (!sequence) {
      throw new NotFoundException(`Séquence ${sequenceId} introuvable`);
    }
    const groupIds = await this.loadGroupIds(this.dataSource.manager, sequenceId);
    return { ...toView(sequence), groupIds };
  }

  private async loadGroupIds(manager: EntityManager, sequenceId: number): Promise<number[]> {
    const rows = await manager.find(ProgramSequenceGroup, {
      where: { sequenceId },
      order: { groupId: 'ASC' },
    });
    return rows.map((row) => row.groupId);
  }

  /** Remplace la liste des groupes de rassemblement liés au créneau. */
  async setSequenceGroups(
    user: ProgramRequestUser,
    sequenceId: number,
    dto: SetSequenceGroupsDto,
  ): Promise<ProgramSequenceDetailView> {
    if (
      !Array.isArray(dto.groupIds) ||
      !dto.groupIds.every((id) => Number.isInteger(id) && id > 0)
    ) {
      throw new BadRequestException('Liste de groupes invalide.');
    }
    const wanted = [...new Set(dto.groupIds)];
    return this.dataSource.transaction(async (manager) => {
      await this.missionTiming?.lock(manager);
      const sequence = await this.loadSequence(manager, sequenceId);
      if (wanted.length) {
        const found = await manager.find(Group, { where: { id: In(wanted) } });
        if (found.length !== wanted.length) {
          throw new BadRequestException('Un ou plusieurs groupes sont introuvables.');
        }
      }
      const before = await this.loadGroupIds(manager, sequenceId);
      await manager.delete(ProgramSequenceGroup, { sequenceId });
      if (wanted.length) {
        await manager.save(
          wanted.map((groupId) => manager.create(ProgramSequenceGroup, { sequenceId, groupId })),
        );
      }
      await this.writeLog(manager, {
        action: ProgramChangeLogAction.UPDATE,
        user,
        eventDate: sequence.eventDate,
        affectedSequenceIds: [sequenceId],
        before: { groupIds: before },
        after: { groupIds: wanted },
        comment: `Groupes de rassemblement liés à « ${sequence.title} » mis à jour.`,
      });
      const refreshed = await manager.findOneOrFail(ProgramSequence, {
        where: { id: sequenceId },
        relations: { volunteerTeam: true, frozenByUser: true },
      });
      return { ...toView(refreshed), groupIds: wanted };
    });
  }

  /**
   * Duplique le créneau : copie hors chaîne (pas de prédécesseur ni de repère, donc
   * aucun décalage des autres créneaux), non figée, titre suffixé « (copie) ». Missions,
   * documents, groupes liés et tâches de préparation (remises à « à faire ») sont repris.
   */
  async duplicateSequence(
    user: ProgramRequestUser,
    sequenceId: number,
  ): Promise<ProgramSequenceDetailView> {
    return this.dataSource.transaction(async (manager) => {
      await this.missionTiming?.lock(manager);
      const source = await this.loadSequence(manager, sequenceId);
      const suffix = ' (copie)';
      const title =
        source.title.length + suffix.length > MAX_TITLE_LENGTH
          ? source.title.slice(0, MAX_TITLE_LENGTH - suffix.length) + suffix
          : source.title + suffix;
      const copy = await manager.save(
        manager.create(ProgramSequence, {
          eventDate: source.eventDate,
          location: source.location,
          title,
          startTime: source.startTime,
          durationMinutes: source.durationMinutes,
          endTime: source.endTime,
          status: ProgramSequenceStatus.MOBILE,
          track: source.track,
          visibility: source.visibility,
          minDurationMinutes: source.minDurationMinutes,
          minMarginMinutes: source.minMarginMinutes,
          previousSequenceId: null,
          anchorSequenceId: null,
          volunteerTeamId: source.volunteerTeamId,
          missionIds: [...(source.missionIds ?? [])],
          documentLinks: (source.documentLinks ?? []).map((link) => ({ ...link })),
          notes: source.notes,
          frozenByUserId: null,
          frozenAt: null,
        }),
      );
      const groupIds = await this.loadGroupIds(manager, sequenceId);
      if (groupIds.length) {
        await manager.save(
          groupIds.map((groupId) =>
            manager.create(ProgramSequenceGroup, { sequenceId: copy.id, groupId }),
          ),
        );
      }
      const tasks = await manager.find(EventPreparationTask, { where: { sequenceId } });
      if (tasks.length) {
        await manager.save(
          tasks.map((task) =>
            manager.create(EventPreparationTask, {
              sequenceId: copy.id,
              title: task.title,
              dueOffsetMinutes: task.dueOffsetMinutes,
              dueDate: task.dueDate,
              responsible: task.responsible,
              isDone: false,
              doneAt: null,
            }),
          ),
        );
      }
      await this.writeLog(manager, {
        action: ProgramChangeLogAction.INSERT,
        user,
        eventDate: copy.eventDate,
        affectedSequenceIds: [copy.id],
        before: null,
        after: { duplicatedFrom: sequenceId },
        comment: `Duplication de « ${source.title} » (créneau #${sequenceId}).`,
      });
      const refreshed = await manager.findOneOrFail(ProgramSequence, {
        where: { id: copy.id },
        relations: { volunteerTeam: true, frozenByUser: true },
      });
      return { ...toView(refreshed), groupIds };
    });
  }

  // ── Tâches de préparation ───────────────────────────────────────────────

  private toTaskView(task: EventPreparationTask): EventTaskView {
    return {
      id: task.id,
      sequenceId: task.sequenceId,
      title: task.title,
      dueOffsetMinutes: task.dueOffsetMinutes,
      dueDate: task.dueDate ? String(task.dueDate) : null,
      responsible: task.responsible,
      isDone: task.isDone,
      doneAt: task.doneAt ? new Date(task.doneAt).toISOString() : null,
      createdAt: new Date(task.createdAt).toISOString(),
      updatedAt: new Date(task.updatedAt).toISOString(),
    };
  }

  /** Exactement une échéance : relative (minutes avant le début) ou date fixe. Renvoie la date normalisée. */
  private validateTaskDue(
    dueOffsetMinutes: number | null | undefined,
    dueDate: string | null | undefined,
  ): string | null {
    const hasOffset = dueOffsetMinutes !== undefined && dueOffsetMinutes !== null;
    const hasDate = dueDate !== undefined && dueDate !== null && dueDate !== '';
    if (hasOffset === hasDate) {
      throw new BadRequestException(
        "L'échéance est soit relative (minutes avant le début), soit une date fixe.",
      );
    }
    if (hasOffset) {
      if (
        !Number.isInteger(dueOffsetMinutes) ||
        dueOffsetMinutes! < 0 ||
        dueOffsetMinutes! > 10080
      ) {
        throw new BadRequestException(
          "L'échéance relative est un nombre de minutes entre 0 et 10080.",
        );
      }
      return null;
    }
    this.assertDate(dueDate!);
    return dueDate!;
  }

  async listTasks(sequenceId: number): Promise<EventTaskView[]> {
    await this.loadSequence(this.dataSource.manager, sequenceId);
    const tasks = await this.dataSource.manager.find(EventPreparationTask, {
      where: { sequenceId },
      order: { id: 'ASC' },
    });
    return tasks.map((task) => this.toTaskView(task));
  }

  async createTask(
    user: ProgramRequestUser,
    sequenceId: number,
    dto: CreateTaskDto,
  ): Promise<EventTaskView> {
    this.assertTitle(dto.title);
    const dueDate = this.validateTaskDue(dto.dueOffsetMinutes, dto.dueDate);
    return this.dataSource.transaction(async (manager) => {
      await this.missionTiming?.lock(manager);
      const sequence = await this.loadSequence(manager, sequenceId);
      const task = await manager.save(
        manager.create(EventPreparationTask, {
          sequenceId,
          title: dto.title.trim(),
          dueOffsetMinutes: dueDate === null ? dto.dueOffsetMinutes! : null,
          dueDate,
          responsible: dto.responsible?.trim() ? dto.responsible.trim().slice(0, 150) : null,
          isDone: false,
          doneAt: null,
        }),
      );
      await this.writeLog(manager, {
        action: ProgramChangeLogAction.UPDATE,
        user,
        eventDate: sequence.eventDate,
        affectedSequenceIds: [sequenceId],
        before: null,
        after: { task: this.toTaskView(task) },
        comment: `Tâche de préparation ajoutée à « ${sequence.title} » : ${task.title}.`,
      });
      return this.toTaskView(task);
    });
  }

  async updateTask(
    user: ProgramRequestUser,
    sequenceId: number,
    taskId: number,
    dto: UpdateTaskDto,
  ): Promise<EventTaskView> {
    return this.dataSource.transaction(async (manager) => {
      await this.missionTiming?.lock(manager);
      const sequence = await this.loadSequence(manager, sequenceId);
      const task = await manager.findOne(EventPreparationTask, {
        where: { id: taskId, sequenceId },
      });
      if (!task) {
        throw new NotFoundException(`Tâche ${taskId} introuvable`);
      }
      const before = this.toTaskView(task);
      if (dto.title !== undefined) {
        this.assertTitle(dto.title);
        task.title = dto.title.trim();
      }
      if (dto.responsible !== undefined) {
        task.responsible = dto.responsible?.trim() ? dto.responsible.trim().slice(0, 150) : null;
      }
      if (dto.dueOffsetMinutes !== undefined || dto.dueDate !== undefined) {
        const offset = dto.dueOffsetMinutes !== undefined ? dto.dueOffsetMinutes : null;
        const date = dto.dueDate !== undefined ? dto.dueDate : null;
        const dueDate = this.validateTaskDue(offset, date);
        task.dueOffsetMinutes = dueDate === null ? offset : null;
        task.dueDate = dueDate;
      }
      if (dto.isDone !== undefined) {
        task.isDone = dto.isDone;
        task.doneAt = dto.isDone ? new Date() : null;
      }
      const saved = await manager.save(task);
      await this.writeLog(manager, {
        action: ProgramChangeLogAction.UPDATE,
        user,
        eventDate: sequence.eventDate,
        affectedSequenceIds: [sequenceId],
        before: { task: before },
        after: { task: this.toTaskView(saved) },
        comment: `Tâche de préparation mise à jour : ${saved.title}.`,
      });
      return this.toTaskView(saved);
    });
  }

  async deleteTask(
    user: ProgramRequestUser,
    sequenceId: number,
    taskId: number,
  ): Promise<{ deletedId: number }> {
    return this.dataSource.transaction(async (manager) => {
      await this.missionTiming?.lock(manager);
      const sequence = await this.loadSequence(manager, sequenceId);
      const task = await manager.findOne(EventPreparationTask, {
        where: { id: taskId, sequenceId },
      });
      if (!task) {
        throw new NotFoundException(`Tâche ${taskId} introuvable`);
      }
      await manager.remove(task);
      await this.writeLog(manager, {
        action: ProgramChangeLogAction.UPDATE,
        user,
        eventDate: sequence.eventDate,
        affectedSequenceIds: [sequenceId],
        before: { task: this.toTaskView(task) },
        after: null,
        comment: `Tâche de préparation supprimée de « ${sequence.title} » : ${task.title}.`,
      });
      return { deletedId: taskId };
    });
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
    visibility?: ProgramSequenceVisibility;
    minDurationMinutes?: number | null;
    minMarginMinutes?: number | null;
    missionIds?: number[];
    documentLinks?: ProgramDocumentLink[];
    track?: ProgramSequenceTrack;
  }): Partial<ProgramSequence> {
    const patch: Partial<ProgramSequence> = {};
    if (dto.track !== undefined) {
      patch.track = this.assertTrack(dto.track);
    }
    if (dto.visibility !== undefined) {
      if (!Object.values(ProgramSequenceVisibility).includes(dto.visibility)) {
        throw new BadRequestException('Visibilité invalide : PUBLIC ou INTERNAL attendu.');
      }
      patch.visibility = dto.visibility;
    }
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
      if (
        !Array.isArray(dto.missionIds) ||
        !dto.missionIds.every((id) => Number.isInteger(id) && id > 0)
      ) {
        throw new BadRequestException('Liste de missions invalide.');
      }
      patch.missionIds = [...new Set(dto.missionIds)];
    }
    if (dto.documentLinks !== undefined) {
      patch.documentLinks = this.normalizeLinks(dto.documentLinks);
    }
    return patch;
  }

  /** Valide une piste fournie ; renvoie la valeur par défaut (temps commun) si absente. */
  private assertTrack(track: ProgramSequenceTrack | undefined): ProgramSequenceTrack {
    if (track === undefined || track === null) return ProgramSequenceTrack.COMMON;
    if (!Object.values(ProgramSequenceTrack).includes(track)) {
      throw new BadRequestException('Piste invalide : TA, ES ou COMMON attendu.');
    }
    return track;
  }

  /**
   * Régénère l'instantané public (grands temps) de chaque jour ayant au moins une
   * séquence publique, et vide les jours sans séquence publique. Action explicite
   * « Mettre à jour la liste publique » : jamais de régénération automatique.
   */
  async regeneratePublicExports(
    user: ProgramRequestUser,
  ): Promise<{ dates: string[]; generatedAt: string }> {
    const sequences = await this.dataSource.manager.find(ProgramSequence, {
      where: { visibility: ProgramSequenceVisibility.PUBLIC },
      order: { eventDate: 'ASC', startTime: 'ASC' },
    });
    const generatedAt = new Date();
    const byDate = new Map<string, ProgramSequence[]>();
    for (const sequence of sequences) {
      const list = byDate.get(sequence.eventDate) ?? [];
      list.push(sequence);
      byDate.set(sequence.eventDate, list);
    }
    return this.dataSource.transaction(async (manager) => {
      await this.missionTiming?.lock(manager);
      const tx = manager.getRepository(ProgramPublicExport);
      const dates = [...byDate.keys()];
      for (const [date, daySequences] of byDate) {
        await tx.save(
          tx.create({
            eventDate: date,
            sequences: daySequences.map((sequence) => ({
              title: sequence.title,
              startTime: sequence.startTime,
              endTime: sequence.endTime,
              location: sequence.location,
            })),
            generatedByUserId: user.id,
            generatedAt,
          }),
        );
      }
      await tx
        .createQueryBuilder()
        .delete()
        .where('"eventDate" NOT IN (:...dates)', { dates: dates.length ? dates : [''] })
        .execute();
      await this.writeLog(manager, {
        action: ProgramChangeLogAction.UPDATE,
        user,
        eventDate: dates[0] ?? generatedAt.toISOString().slice(0, 10),
        affectedSequenceIds: [],
        before: null,
        after: { dates },
        comment: `Mise à jour de la liste publique (${dates.length} jour(s)).`,
      });
      return { dates, generatedAt: generatedAt.toISOString() };
    });
  }

  /** État des instantanés publics (jour, date de génération, nombre de grands temps). */
  async getPublicExportsStatus(): Promise<
    { eventDate: string; generatedAt: string; sequenceCount: number }[]
  > {
    const exports = await this.dataSource.manager.find(ProgramPublicExport, {
      order: { eventDate: 'ASC' },
    });
    return exports.map((entry) => ({
      eventDate: entry.eventDate,
      generatedAt: new Date(entry.generatedAt).toISOString(),
      sequenceCount: entry.sequences.length,
    }));
  }

  /** Instantané public d'un jour, lu par l'appli non connectée ; vide si jamais publié. */
  async getPublicProgramDay(
    date: string,
  ): Promise<{
    date: string;
    updatedAt: string | null;
    sequences: ProgramPublicExport['sequences'];
  }> {
    const entry = await this.dataSource.manager.findOne(ProgramPublicExport, {
      where: { eventDate: date },
    });
    return {
      date,
      updatedAt: entry ? new Date(entry.generatedAt).toISOString() : null,
      sequences: entry?.sequences ?? [],
    };
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
