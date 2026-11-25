import { BadRequestException } from '@nestjs/common';
export type MissionPhase = 'BEFORE' | 'DURING' | 'AFTER';
export interface ShiftBindingDraft {
  shiftId: number;
  startAnchor: 'START' | 'END';
  endAnchor: 'START' | 'END';
  startOffset: number;
  endOffset: number;
  /** Exact previous pilot is required, including null for a currently unbound shift. */
  previousSequenceId: number | null;
}
const formatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
/** Reject ambiguous/nonexistent wall times rather than guessing at a DST boundary. */
export function parisInstant(date: string, time: string): number {
  const wall = `${date} ${time}`;
  const stamp = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(stamp)) throw new BadRequestException('Date ou heure invalide.');
  const matches = [-120, -60]
    .map((offset) => stamp + offset * 60000)
    .filter((value) => formatter.format(new Date(value)) === wall);
  if (matches.length !== 1)
    throw new BadRequestException(
      'Heure de Paris ambiguë ou inexistante. Choisir une autre heure.',
    );
  return matches[0];
}
export function linkedTiming(date: string, start: string, end: string, draft: ShiftBindingDraft) {
  if (
    !['START', 'END'].includes(draft.startAnchor) ||
    !['START', 'END'].includes(draft.endAnchor) ||
    ![draft.startOffset, draft.endOffset].every((n) => Number.isInteger(n) && Math.abs(n) <= 525600)
  ) {
    throw new BadRequestException(
      'Repères et décalages entiers explicites obligatoires (limite un an).',
    );
  }
  const nextDate =
    end <= start
      ? new Date(Date.parse(date + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10)
      : date;
  const anchors = { START: parisInstant(date, start), END: parisInstant(nextDate, end) };
  const startAt = anchors[draft.startAnchor] + draft.startOffset * 60000;
  const endAt = anchors[draft.endAnchor] + draft.endOffset * 60000;
  if (endAt <= startAt)
    throw new BadRequestException('La fin du créneau bénévole doit suivre son début.');
  return { startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString() };
}
