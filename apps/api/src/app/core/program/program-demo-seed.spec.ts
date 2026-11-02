import { EntityManager } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { ProgramSequenceStatus } from '../entities';
import { insertProgramDemoDay, PROGRAM_SEED_DAYS } from './program-demo-seed';

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

describe('programme de démonstration', () => {
  it('couvre les 4 jours de l’événement', () => {
    expect(PROGRAM_SEED_DAYS.map((day) => day.eventDate)).toEqual([
      '2027-10-30',
      '2027-10-31',
      '2027-11-01',
      '2027-11-02',
    ]);
  });

  it.each(PROGRAM_SEED_DAYS.map((day) => [day.eventDate, day] as const))(
    '%s : chaîne principale continue, sans chevauchement, branches rattachées à un créneau existant',
    (_date, day) => {
      expect(day.slots.length).toBeGreaterThanOrEqual(6);
      day.slots.forEach((slot, index) => {
        expect(slot.minDurationMinutes).toBeLessThanOrEqual(slot.durationMinutes);
        if (index > 0) {
          const previous = day.slots[index - 1];
          expect(toMinutes(slot.startTime)).toBeGreaterThanOrEqual(
            toMinutes(previous.startTime) + previous.durationMinutes,
          );
        }
      });
      for (const branch of day.branches) {
        for (const entry of branch.items) {
          expect(day.slots[entry.slot]).toBeDefined();
        }
      }
    },
  );

  it('insertProgramDemoDay crée la chaîne et les branches avec les bons pointeurs', async () => {
    const saved: Record<string, unknown>[] = [];
    const repository = {
      create: (value: Record<string, unknown>) => value,
      save: async (value: Record<string, unknown>) => {
        const row = { ...value, id: saved.length + 1 };
        saved.push(row);
        return row;
      },
    };
    const manager = { getRepository: () => repository } as unknown as EntityManager;
    const day = PROGRAM_SEED_DAYS[0];
    const expected =
      day.slots.length + day.branches.reduce((sum, branch) => sum + branch.items.length, 0);

    const created = await insertProgramDemoDay(manager, day, { teamIds: [10, 11], coordinatorId: 3 });

    expect(created).toBe(expected);
    expect(saved).toHaveLength(expected);
    const main = saved.filter((row) => row['location'] === 'Grande salle');
    expect(main[0]['previousSequenceId']).toBeNull();
    expect(main[1]['previousSequenceId']).toBe(main[0]['id']);
    const frozen = saved.filter((row) => row['status'] === ProgramSequenceStatus.FROZEN);
    expect(frozen.length).toBeGreaterThan(0);
    expect(frozen.every((row) => row['frozenByUserId'] === 3)).toBe(true);
    expect(new Set(saved.map((row) => row['volunteerTeamId']))).toEqual(new Set([10, 11]));
    expect(saved.some((row) => row['anchorSequenceId'] !== null)).toBe(true);
  });
});
