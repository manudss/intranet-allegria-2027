import type { EntityManager } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { ProgramSequence, User, VolunteerTeam } from '../../app/core/entities';
import { PROGRAM_SEED_DAYS } from '../../app/core/program/program-demo-seed';
import { fillEmptyProgramDays, previewProgramSeedEnabled } from './seed-preview-program';

const fakeManager = (existingByDate: Record<string, number>) => {
  const saved: Record<string, unknown>[] = [];
  const repository = {
    create: (value: Record<string, unknown>) => value,
    save: async (value: Record<string, unknown>) => {
      const row = { ...value, id: saved.length + 1 };
      saved.push(row);
      return row;
    },
  };
  const manager = {
    find: async (entity: unknown) => (entity === VolunteerTeam ? [{ id: 1 }, { id: 2 }] : []),
    findOne: async (entity: unknown) => (entity === User ? { id: 9 } : null),
    count: async (entity: unknown, options: { where: { eventDate: string } }) =>
      entity === ProgramSequence ? (existingByDate[options.where.eventDate] ?? 0) : 0,
    delete: () => {
      throw new Error('le peuplement de preview ne doit jamais supprimer');
    },
    getRepository: () => repository,
  } as unknown as EntityManager;
  return { manager, saved };
};

describe('peuplement du programme en preview', () => {
  it('ne s’active que si PREVIEW_SEED_PROGRAM vaut exactement "true"', () => {
    expect(previewProgramSeedEnabled({})).toBe(false);
    expect(previewProgramSeedEnabled({ PREVIEW_SEED_PROGRAM: '1' })).toBe(false);
    expect(previewProgramSeedEnabled({ PREVIEW_SEED_PROGRAM: 'true' })).toBe(true);
  });

  it('remplit les 4 jours d’une base vide', async () => {
    const { manager, saved } = fakeManager({});
    const result = await fillEmptyProgramDays(manager);
    expect(result.filled).toEqual(PROGRAM_SEED_DAYS.map((d) => d.eventDate));
    expect(result.skipped).toEqual([]);
    expect(saved.length).toBeGreaterThan(PROGRAM_SEED_DAYS.length * 6);
  });

  it('ne touche jamais un jour déjà renseigné (créneau saisi à la main) et ne supprime rien', async () => {
    const { manager, saved } = fakeManager({ '2027-10-30': 1 });
    const result = await fillEmptyProgramDays(manager);
    expect(result.skipped).toEqual(['2027-10-30']);
    expect(result.filled).toEqual(['2027-10-31', '2027-11-01', '2027-11-02']);
    expect(saved.every((row) => row['eventDate'] !== '2027-10-30')).toBe(true);
  });

  it('est idempotent : tout est ignoré si tous les jours ont des données', async () => {
    const { manager, saved } = fakeManager(
      Object.fromEntries(PROGRAM_SEED_DAYS.map((d) => [d.eventDate, 5])),
    );
    const result = await fillEmptyProgramDays(manager);
    expect(result.filled).toEqual([]);
    expect(saved).toHaveLength(0);
  });
});
