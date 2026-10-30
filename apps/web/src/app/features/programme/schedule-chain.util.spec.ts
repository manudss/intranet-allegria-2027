import { describe, expect, it } from 'vitest';
import { ProgramSequence, ProgramSequenceStatus } from '../../models/models';
import { ALLEGRIA_2027_EVENT_DATES } from '../../shared/event-date-selector/event-date.config';
import { buildChain, PROGRAM_EVENT_DAYS } from './schedule-chain.util';

function seq(id: number, previousSequenceId: number | null, location = 'A'): ProgramSequence {
  return {
    id,
    eventDate: '2027-10-31',
    location,
    title: `S${id}`,
    startTime: '08:00',
    durationMinutes: 60,
    endTime: '09:00',
    status: ProgramSequenceStatus.MOBILE,
    minDurationMinutes: null,
    minMarginMinutes: null,
    previousSequenceId,
    anchorSequenceId: null,
    volunteerTeamId: null,
    volunteerTeamName: null,
    missionIds: [],
    documentLinks: [],
    notes: null,
    frozenByUserId: null,
    frozenByUserName: null,
    frozenAt: null,
  };
}

describe('schedule-chain.util', () => {
  it('buildChain ordonne la chaîne depuis les pointeurs previousSequenceId', () => {
    const chain = buildChain([seq(3, 2), seq(1, null), seq(2, 1)], '2027-10-31', 'A');
    expect(chain.map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it('buildChain isole le lieu et le jour demandés', () => {
    const sequences = [seq(1, null), seq(2, null, 'B')];
    expect(buildChain(sequences, '2027-10-31', 'B').map((s) => s.id)).toEqual([2]);
    expect(buildChain(sequences, '2027-11-01', 'A')).toEqual([]);
  });

  it('PROGRAM_EVENT_DAYS commence au premier jour configuré, sans décalage de fuseau', () => {
    expect(PROGRAM_EVENT_DAYS).toHaveLength(4);
    expect(PROGRAM_EVENT_DAYS[0]).toBe(ALLEGRIA_2027_EVENT_DATES.startDate);
    expect(PROGRAM_EVENT_DAYS[3]).toBe(ALLEGRIA_2027_EVENT_DATES.endDate);
  });
});
