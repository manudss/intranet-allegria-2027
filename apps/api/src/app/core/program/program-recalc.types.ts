import { ProgramSequenceStatus } from '../entities';

/** Vue plate d'une séquence, indépendante de TypeORM, utilisée par le moteur de recalcul. */
export interface ProgramSequenceData {
  id: number;
  eventDate: string;
  location: string;
  title: string;
  startTime: string;
  durationMinutes: number;
  endTime: string;
  status: ProgramSequenceStatus;
  minDurationMinutes: number | null;
  minMarginMinutes: number | null;
  previousSequenceId: number | null;
  anchorSequenceId: number | null;
  volunteerTeamId: number | null;
  notes: string | null;
}

export interface ProgramSequenceDraft {
  eventDate: string;
  location: string;
  title: string;
  durationMinutes: number;
  volunteerTeamId: number | null;
  notes: string | null;
  minDurationMinutes?: number | null;
  minMarginMinutes?: number | null;
}

export interface ProgramSequenceTiming {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface ProgramSequenceDiff {
  sequenceId: number;
  title: string;
  before: ProgramSequenceTiming;
  after: ProgramSequenceTiming;
}

export type ProgramRecalcOutcome = 'ok' | 'partial' | 'impossible';

/** Séquence à créer : identique à ProgramSequenceData sans id (attribué à la persistance). */
export type ProgramNewSequence = Omit<ProgramSequenceData, 'id'>;

export interface ProgramInsertPreview {
  kind: 'insert';
  afterSequenceId: number;
  draft: ProgramSequenceDraft;
  newSequence: ProgramNewSequence;
  affected: ProgramSequenceDiff[];
  outcome: ProgramRecalcOutcome;
  message: string;
}

export interface ProgramResizePreview {
  kind: 'resize';
  sequenceId: number;
  previousDurationMinutes: number;
  newDurationMinutes: number;
  affected: ProgramSequenceDiff[];
  stoppedAtFrozenId: number | null;
  marginMinutes: number | null;
  outcome: ProgramRecalcOutcome;
  message: string;
}

export type ProgramPreview = ProgramInsertPreview | ProgramResizePreview;
