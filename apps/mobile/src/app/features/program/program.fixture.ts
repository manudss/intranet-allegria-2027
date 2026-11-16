import {
  ProgramDay,
  ProgramSequence,
  ProgramSequenceStatus,
  ProgramSequenceTrack,
} from '../../models/models';

export function seq(
  id: number,
  startTime: string,
  overrides: Partial<ProgramSequence> = {},
): ProgramSequence {
  return {
    id,
    eventDate: '2027-10-31',
    location: 'Grande salle',
    title: `Séquence ${id}`,
    startTime,
    durationMinutes: 60,
    endTime: '13:00',
    status: ProgramSequenceStatus.MOBILE,
    track: ProgramSequenceTrack.COMMON,
    volunteerTeamId: null,
    volunteerTeamName: null,
    notes: null,
    ...overrides,
  };
}

export function dayOf(...sequences: ProgramSequence[]): ProgramDay {
  return { date: '2027-10-31', sequences };
}
