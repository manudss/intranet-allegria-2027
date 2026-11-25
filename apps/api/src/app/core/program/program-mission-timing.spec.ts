import { describe, it, expect } from 'vitest';
import { DataSource, EntityManager } from 'typeorm';
import { ProgramMissionTimingService, ShiftTimingDiff } from './program-mission-timing.service';
const service = new ProgramMissionTimingService({} as DataSource);
function manager(rows: unknown[]): EntityManager {
  return { query: async () => rows } as unknown as EntityManager;
}
const diff = (shiftId: number, startAt: string, endAt: string): ShiftTimingDiff => ({
  shiftId,
  missionId: 1,
  sequenceId: 1,
  title: 'Test',
  before: { startAt, endAt },
  after: { startAt, endAt },
});
const a = {
  volunteer_id: 1,
  shift_id: 1,
  startAt: '2027-11-02T10:00:00Z',
  endAt: '2027-11-02T11:00:00Z',
};
const b = {
  volunteer_id: 1,
  shift_id: 2,
  startAt: '2027-11-02T11:00:00Z',
  endAt: '2027-11-02T12:00:00Z',
};
describe('Conflits des créneaux liés', () => {
  it('ne bloque pas deux bornes contiguës', async () =>
    expect(await service.conflicts(manager([a, b]), [diff(1, a.startAt, a.endAt)])).toEqual([]));
  it('bloque le chevauchement nouvellement créé', async () =>
    expect(
      await service.conflicts(manager([a, b]), [diff(1, a.startAt, '2027-11-02T11:30:00Z')]),
    ).toHaveLength(1));
  it('utilise les horaires après des deux créneaux', async () =>
    expect(
      await service.conflicts(manager([a, b]), [
        diff(1, '2027-11-02T11:00:00Z', '2027-11-02T12:00:00Z'),
        diff(2, '2027-11-02T12:00:00Z', '2027-11-02T13:00:00Z'),
      ]),
    ).toEqual([]));
  it('ignore un autre bénévole', async () =>
    expect(
      await service.conflicts(manager([a, { ...b, volunteer_id: 2 }]), [
        diff(1, a.startAt, '2027-11-02T11:30:00Z'),
      ]),
    ).toEqual([]));
  it('ne bloque pas un conflit inchangé sans créneau affecté', async () =>
    expect(await service.conflicts(manager([a, { ...b, startAt: a.startAt }]), [])).toEqual([]));
  it('refuse un changement de pilote non explicitement fondé sur le pilote courant', async () => {
    const m = {
      query: async (q: string) =>
        q.includes('FROM program_sequences')
          ? [
              {
                id: 2,
                eventDate: '2027-11-02',
                startTime: '13:30',
                endTime: '15:30',
                missionIds: [1],
              },
            ]
          : q.includes('m.title')
            ? [{ id: 3, mission_id: 1, startAt: a.startAt, endAt: a.endAt, title: 'Test' }]
            : q.includes('program_shift_bindings')
              ? [{ sequence_id: 5 }]
              : [],
    } as unknown as EntityManager;
    await expect(
      service.bindingPlan(m, 2, {
        shiftId: 3,
        startAnchor: 'START',
        endAnchor: 'END',
        startOffset: 0,
        endOffset: 0,
        previousSequenceId: null,
      }),
    ).rejects.toThrow('pilote a changé');
  });
  it('refuse mission non liée', async () => {
    const m = {
      query: async (q: string) =>
        q.includes('FROM program_sequences') ? [{ missionIds: [] }] : [{ id: 3, mission_id: 1 }],
    } as unknown as EntityManager;
    await expect(
      service.bindingPlan(m, 2, {
        shiftId: 3,
        startAnchor: 'START',
        endAnchor: 'END',
        startOffset: 0,
        endOffset: 0,
        previousSequenceId: null,
      }),
    ).rejects.toThrow("n'est pas liée");
  });
});
