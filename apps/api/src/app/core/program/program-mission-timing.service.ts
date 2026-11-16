import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ProgramSequenceDiff } from './program-recalc.types';
import { linkedTiming, MissionPhase, ShiftBindingDraft } from './mission-timing.util';

export interface ShiftTimingDiff {
  shiftId: number;
  missionId: number;
  title: string;
  sequenceId: number;
  before: { startAt: string; endAt: string };
  after: { startAt: string; endAt: string };
}
interface BindingRow {
  shift_id: number;
  sequence_id: number;
  start_anchor: 'START' | 'END';
  end_anchor: 'START' | 'END';
  start_offset: number;
  end_offset: number;
}
interface ShiftRow {
  id: number;
  mission_id: number;
  startAt: Date;
  endAt: Date;
  title: string;
}

@Injectable()
export class ProgramMissionTimingService {
  constructor(@InjectDataSource() private readonly source: DataSource) {}
  async lock(manager: EntityManager) {
    await manager.query('SELECT pg_advisory_xact_lock(71927, 2)');
  }
  private async audit(
    m: EntityManager,
    sequenceId: number,
    actorId: number | undefined,
    comment: string,
    before: unknown,
    after: unknown,
  ) {
    if (!actorId) return;
    await m.query(
      `INSERT INTO program_change_logs(action,author_user_id,"eventDate","affectedSequenceIds","beforeSnapshot","afterSnapshot",comment) SELECT 'UPDATE',$1,"eventDate",$2::jsonb,$3::jsonb,$4::jsonb,$5 FROM program_sequences WHERE id=$6`,
      [
        actorId,
        JSON.stringify([sequenceId]),
        JSON.stringify(before),
        JSON.stringify(after),
        comment,
        sequenceId,
      ],
    );
  }
  async list(sequenceId: number, manager = this.source.manager) {
    const [sequence] = await manager.query(
      'SELECT id, "missionIds" FROM program_sequences WHERE id=$1',
      [sequenceId],
    );
    if (!sequence) throw new NotFoundException('Événement introuvable.');
    const phases = await manager.query(
      'SELECT mission_id AS "missionId", phase FROM program_mission_phases WHERE sequence_id=$1 ORDER BY mission_id',
      [sequenceId],
    );
    const bindings = await manager.query(
      `SELECT b.shift_id AS "shiftId", b.sequence_id AS "sequenceId", b.start_anchor AS "startAnchor", b.end_anchor AS "endAnchor", b.start_offset AS "startOffset", b.end_offset AS "endOffset"
      FROM program_shift_bindings b JOIN volunteer_shifts s ON s.id=b.shift_id WHERE s.mission_id = ANY($1::int[]) ORDER BY b.shift_id`,
      [sequence.missionIds ?? []],
    );
    return { phases, bindings };
  }
  async setPhase(sequenceId: number, missionId: number, phase: MissionPhase, actorId?: number) {
    if (!['BEFORE', 'DURING', 'AFTER'].includes(phase))
      throw new BadRequestException('Phase invalide.');
    return this.source.transaction(async (m) => {
      await this.lock(m);
      const [s] = await m.query('SELECT "missionIds" FROM program_sequences WHERE id=$1', [
        sequenceId,
      ]);
      if (!s || !s.missionIds.includes(missionId))
        throw new BadRequestException("Lier la mission à l'événement avant de la classer.");
      const before = await this.list(sequenceId, m);
      await m.query(
        `INSERT INTO program_mission_phases VALUES ($1,$2,$3) ON CONFLICT(sequence_id,mission_id) DO UPDATE SET phase=EXCLUDED.phase`,
        [sequenceId, missionId, phase],
      );
      await this.audit(m, sequenceId, actorId, 'Phase de mission modifiée.', before, {
        missionId,
        phase,
      });
      return this.list(sequenceId, m);
    });
  }
  async version(manager: EntityManager): Promise<string> {
    // All inputs used by timing/conflict checks, with stable ordering. No PII in the returned digest.
    const rows = await manager.query(`SELECT
      (SELECT coalesce(json_agg(s ORDER BY s.id),'[]') FROM program_sequences s) AS sequences,
      (SELECT coalesce(json_agg(b ORDER BY b.shift_id),'[]') FROM program_shift_bindings b) AS bindings,
      (SELECT coalesce(json_agg(s ORDER BY s.id),'[]') FROM volunteer_shifts s) AS shifts,
      (SELECT coalesce(json_agg(a ORDER BY a.id),'[]') FROM volunteer_shift_assignments a) AS assignments`);
    return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  }
  async plan(manager: EntityManager, eventDate: string, diffs: ProgramSequenceDiff[]) {
    if (!diffs.length) return { shifts: [] as ShiftTimingDiff[], conflicts: [] as string[] };
    const bindings: BindingRow[] = await manager.query(
      'SELECT * FROM program_shift_bindings WHERE sequence_id = ANY($1::int[]) ORDER BY shift_id',
      [diffs.map((d) => d.sequenceId)],
    );
    const shifts: ShiftTimingDiff[] = [];
    for (const b of bindings) {
      const d = diffs.find((d) => d.sequenceId === b.sequence_id)!;
      const [s]: ShiftRow[] = await manager.query(
        `SELECT s.*, m.title FROM volunteer_shifts s JOIN volunteer_missions m ON m.id=s.mission_id WHERE s.id=$1`,
        [b.shift_id],
      );
      if (!s) throw new ConflictException('Un créneau lié a disparu. Recharger.');
      shifts.push({
        shiftId: s.id,
        missionId: s.mission_id,
        title: s.title,
        sequenceId: b.sequence_id,
        before: {
          startAt: new Date(s.startAt).toISOString(),
          endAt: new Date(s.endAt).toISOString(),
        },
        after: linkedTiming(eventDate, d.after.startTime, d.after.endTime, {
          shiftId: s.id,
          previousSequenceId: b.sequence_id,
          startAnchor: b.start_anchor,
          endAnchor: b.end_anchor,
          startOffset: b.start_offset,
          endOffset: b.end_offset,
        }),
      });
    }
    return { shifts, conflicts: await this.conflicts(manager, shifts) };
  }
  async conflicts(m: EntityManager, changes: ShiftTimingDiff[]) {
    if (!changes.length) return [] as string[];
    const rows = await m.query(
      `SELECT a.volunteer_id, a.shift_id, s."startAt", s."endAt" FROM volunteer_shift_assignments a JOIN volunteer_shifts s ON s.id=a.shift_id WHERE a.status <> 'CANCELLED' AND s.status <> 'CANCELLED' ORDER BY a.volunteer_id,a.shift_id`,
    );
    const conflicts = new Set<string>();
    for (let i = 0; i < rows.length; i++)
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i],
          b = rows[j];
        if (a.volunteer_id !== b.volunteer_id || a.shift_id === b.shift_id) continue;
        const da = changes.find((d) => d.shiftId === a.shift_id),
          db = changes.find((d) => d.shiftId === b.shift_id);
        if (!da && !db) continue;
        const ia = da?.after ?? a,
          ib = db?.after ?? b;
        if (
          Date.parse(ia.startAt) < Date.parse(ib.endAt) &&
          Date.parse(ib.startAt) < Date.parse(ia.endAt)
        )
          conflicts.add(
            `Chevauchement d'affectations entre les créneaux ${a.shift_id} et ${b.shift_id}.`,
          );
      }
    return [...conflicts];
  }
  async apply(m: EntityManager, diffs: ShiftTimingDiff[]) {
    await m.query("SELECT set_config('allegria.program_timing','apply',true)");
    for (const d of diffs)
      await m.query(
        'UPDATE volunteer_shifts SET "startAt"=$1,"endAt"=$2,"updatedAt"=now() WHERE id=$3',
        [d.after.startAt, d.after.endAt, d.shiftId],
      );
  }
  async bindingPlan(m: EntityManager, sequenceId: number, draft: ShiftBindingDraft) {
    if (
      !Number.isInteger(draft.shiftId) ||
      draft.shiftId <= 0 ||
      !(draft.previousSequenceId === null || Number.isInteger(draft.previousSequenceId))
    )
      throw new BadRequestException('Créneau et pilote précédent explicites obligatoires.');
    const [s] = await m.query(
      `SELECT *,to_char("eventDate",'YYYY-MM-DD') AS "eventDate" FROM program_sequences WHERE id=$1`,
      [sequenceId],
    );
    const [shift]: ShiftRow[] = await m.query(
      `SELECT s.*,m.title FROM volunteer_shifts s JOIN volunteer_missions m ON m.id=s.mission_id WHERE s.id=$1`,
      [draft.shiftId],
    );
    if (!s || !shift) throw new NotFoundException('Événement ou créneau introuvable.');
    if (s.status === 'FROZEN')
      throw new ConflictException('Événement figé : défiger avant de lier les horaires.');
    if (!(s.missionIds ?? []).includes(shift.mission_id))
      throw new BadRequestException("La mission n'est pas liée à cet événement.");
    const [b]: BindingRow[] = await m.query(
      'SELECT * FROM program_shift_bindings WHERE shift_id=$1',
      [draft.shiftId],
    );
    if ((b?.sequence_id ?? null) !== draft.previousSequenceId)
      throw new ConflictException('Le pilote a changé : recharger et choisir explicitement.');
    const after = linkedTiming(
      s.eventDate instanceof Date ? s.eventDate.toISOString().slice(0, 10) : String(s.eventDate),
      s.startTime,
      s.endTime,
      draft,
    );
    const change: ShiftTimingDiff = {
      shiftId: shift.id,
      missionId: shift.mission_id,
      title: shift.title,
      sequenceId,
      before: {
        startAt: new Date(shift.startAt).toISOString(),
        endAt: new Date(shift.endAt).toISOString(),
      },
      after,
    };
    return {
      shifts: [change],
      conflicts: await this.conflicts(m, [change]),
      previousSequenceId: b?.sequence_id ?? null,
    };
  }
  async previewBinding(sequenceId: number, draft: ShiftBindingDraft) {
    return this.source.transaction(async (m) => {
      await this.lock(m);
      return { ...(await this.bindingPlan(m, sequenceId, draft)), version: await this.version(m) };
    });
  }
  async applyBinding(
    sequenceId: number,
    draft: ShiftBindingDraft,
    version: string,
    actorId?: number,
  ) {
    return this.source.transaction(async (m) => {
      await this.lock(m);
      if ((await this.version(m)) !== version)
        throw new ConflictException("L'aperçu a changé. Prévisualiser à nouveau.");
      const plan = await this.bindingPlan(m, sequenceId, draft);
      if (plan.conflicts.length) throw new ConflictException(plan.conflicts.join(' '));
      await m.query(
        `INSERT INTO program_shift_bindings VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(shift_id) DO UPDATE SET sequence_id=EXCLUDED.sequence_id,start_anchor=EXCLUDED.start_anchor,end_anchor=EXCLUDED.end_anchor,start_offset=EXCLUDED.start_offset,end_offset=EXCLUDED.end_offset`,
        [
          draft.shiftId,
          sequenceId,
          draft.startAnchor,
          draft.endAnchor,
          draft.startOffset,
          draft.endOffset,
        ],
      );
      await this.apply(m, plan.shifts);
      await this.audit(
        m,
        sequenceId,
        actorId,
        'Pilotage et horaires bénévoles confirmés.',
        plan.shifts.map((d) => d.before),
        { draft, shifts: plan.shifts },
      );
      return plan;
    });
  }
  async removeBinding(sequenceId: number, shiftId: number, actorId?: number) {
    return this.source.transaction(async (m) => {
      await this.lock(m);
      const before = await this.list(sequenceId, m);
      await m.query('DELETE FROM program_shift_bindings WHERE sequence_id=$1 AND shift_id=$2', [
        sequenceId,
        shiftId,
      ]);
      await this.audit(m, sequenceId, actorId, 'Pilotage désactivé, horaires conservés.', before, {
        shiftId,
      });
      return { shiftId };
    });
  }
  async assertMembership(m: EntityManager, sequenceId: number, missionIds: number[]) {
    const bindings = await m.query(
      `SELECT s.mission_id FROM program_shift_bindings b JOIN volunteer_shifts s ON s.id=b.shift_id WHERE b.sequence_id=$1`,
      [sequenceId],
    );
    if (bindings.some((b: { mission_id: number }) => !missionIds.includes(b.mission_id)))
      throw new ConflictException(
        'Désactiver explicitement le pilotage horaire avant de retirer cette mission.',
      );
    await m.query(
      'DELETE FROM program_mission_phases WHERE sequence_id=$1 AND NOT(mission_id=ANY($2::int[]))',
      [sequenceId, missionIds],
    );
  }
}
