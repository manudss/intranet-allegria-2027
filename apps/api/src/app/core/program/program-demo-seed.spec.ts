import { EntityManager } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { ProgramSequenceStatus, ProgramSequenceTrack } from '../entities';
import { ProgramRecalcService } from './program-recalc.service';
import { ProgramSequenceData } from './program-recalc.types';
import { insertProgramDemoDay, PROGRAM_SEED_DAYS } from './program-demo-seed';

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

describe('programme de démonstration', () => {
  it('couvre les 4 jours de l’événement', () => {
    expect(PROGRAM_SEED_DAYS.map((day) => day.eventDate)).toEqual([
      '2027-10-31',
      '2027-11-01',
      '2027-11-02',
      '2027-11-03',
    ]);
  });

  it('reprend le planning projeté : thèmes, groupes TA / ES et créneaux ajoutés signalés', () => {
    const [sunday, monday, tuesday, wednesday] = PROGRAM_SEED_DAYS;
    expect(sunday.slots.map((slot) => slot.title)).toEqual(
      expect.arrayContaining(['Temps de lancement', 'Eucharistie', 'Veillée FESTIVE']),
    );
    expect(monday.slots.map((slot) => slot.title)).toContain('Veillée Spectacle');
    expect(wednesday.slots.map((slot) => slot.title)).toEqual(
      expect.arrayContaining(["Écriture des « J'aime »", 'Clôture avec Mercis-Envoi']),
    );
    for (const day of [monday, tuesday]) {
      expect(day.branches.map((branch) => branch.location)).toEqual(['Groupe TA', 'Groupe ES']);
      expect(day.branches.map((branch) => branch.track)).toEqual(['TA', 'ES']);
    }
    expect(tuesday.branches[0].items.map((item) => item.title)).toContain('Veillée SPI - TA');
    expect(tuesday.branches[1].items.map((item) => item.title)).toContain('Veillée SPI - ES');
    expect(PROGRAM_SEED_DAYS.every((day) => Boolean(day.theme))).toBe(true);
    expect(PROGRAM_SEED_DAYS.some((day) => day.slots.some((slot) => slot.proposed))).toBe(true);
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

  it('insertProgramDemoDay marque les pistes : temps commun sur la chaîne, TA / ES sur les branches', async () => {
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
    // Lundi : jour avec branches TA / ES.
    await insertProgramDemoDay(manager, PROGRAM_SEED_DAYS[1], { teamIds: [10], coordinatorId: 3 });

    const main = saved.filter((row) => row['location'] === 'Grande salle');
    expect(main.length).toBeGreaterThan(0);
    expect(main.every((row) => row['track'] === ProgramSequenceTrack.COMMON)).toBe(true);
    const ta = saved.filter((row) => row['location'] === 'Groupe TA');
    const es = saved.filter((row) => row['location'] === 'Groupe ES');
    expect(ta.length).toBeGreaterThan(0);
    expect(es.length).toBeGreaterThan(0);
    expect(ta.every((row) => row['track'] === ProgramSequenceTrack.TA)).toBe(true);
    expect(es.every((row) => row['track'] === ProgramSequenceTrack.ES)).toBe(true);
    // Les activités de branche (messes, jeux) ne portent pas d'équipe bénévole responsable.
    expect(ta.every((row) => row['volunteerTeamId'] === null)).toBe(true);
    expect(es.every((row) => row['volunteerTeamId'] === null)).toBe(true);
  });

  it.each(PROGRAM_SEED_DAYS.map((day) => [day.eventDate, day] as const))(
    '%s : agrandir un créneau avec le vrai moteur ne produit jamais de chevauchement appliquable',
    (_date, day) => {
      const recalc = new ProgramRecalcService();
      const chain: ProgramSequenceData[] = day.slots.map((slot, index) => ({
        id: index + 1,
        eventDate: day.eventDate,
        location: 'Grande salle',
        title: slot.title,
        startTime: slot.startTime,
        durationMinutes: slot.durationMinutes,
        endTime: addMinutesLocal(slot.startTime, slot.durationMinutes),
        status: slot.frozen ? ProgramSequenceStatus.FROZEN : ProgramSequenceStatus.MOBILE,
        minDurationMinutes: slot.minDurationMinutes,
        minMarginMinutes: null,
        previousSequenceId: index === 0 ? null : index,
        anchorSequenceId: null,
        volunteerTeamId: null,
        notes: null,
      })) as unknown as ProgramSequenceData[];
      for (const target of chain) {
        const preview = recalc.previewResize(chain, target.id, target.durationMinutes + 30);
        if (preview.outcome !== 'ok') continue; // l'API refuse d'appliquer : rien à afficher en chevauchement
        const next = recalc.applyResize(chain, preview);
        next.forEach((slot, index) => {
          if (index === 0) return;
          const previous = next[index - 1];
          expect(toMinutes(slot.startTime)).toBeGreaterThanOrEqual(toMinutes(previous.endTime));
        });
      }
    },
  );
});

const addMinutesLocal = (time: string, minutes: number): string => {
  const total = toMinutes(time) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
