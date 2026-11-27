import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { GatheringGroupCategory, ProgramSequenceTrack } from '../entities';
import { GatheringGroupsService } from './gathering-groups.service';

/** Données fictives : règles de pistes, jauges, capacité bloquante et proposition. */

const repartition = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Grand jeu J2',
  programSequenceId: null,
  allowOverflow: false,
  countAnimators: true,
  notes: null,
  ...overrides,
});

const group = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  repartitionId: 1,
  name: `Groupe ${id}`,
  category: GatheringGroupCategory.MIXTE,
  capacityPersons: 20,
  location: null,
  hostingGroupId: null,
  documentLinkId: null,
  notes: null,
  ...overrides,
});

const team = (id: number, track: ProgramSequenceTrack, name = `Équipe ${id}`) => ({
  id,
  name,
  track,
  group: null,
  primaryAnimator: null,
  secondaryAnimator: null,
});

const ALL = { all: true } as const;
const SCOPED = (ids: number[]) => ({ all: false, gatheringGroupIds: ids }) as const;

const build = (data: {
  repartition?: Record<string, unknown>;
  groups?: ReturnType<typeof group>[];
  links?: { groupId: number; teamId: number; repartitionId: number }[];
  teams?: ReturnType<typeof team>[];
  sizes?: Record<number, { jeunes: number; animateurs: number }>;
  sequenceIds?: number[];
}) => {
  const sequenceLinks = {
    findOneBy: vi.fn(async () => null),
    create: vi.fn((p: unknown) => p),
    save: vi.fn(async (p: unknown) => p),
    delete: vi.fn(async () => undefined),
  };
  const rep = data.repartition ?? repartition();
  const manager = {
    findOne: vi.fn(async (entity: { name?: string }, opts: { where: { id?: number; teamId?: number; repartitionId?: number } }) => {
      const ctorName = (entity as unknown as { name: string }).name;
      if (ctorName === 'GatheringGroup') return data.groups?.find((g) => g.id === opts.where.id) ?? null;
      if (ctorName === 'GatheringRepartition') return rep;
      if (ctorName === 'Team') return data.teams?.find((t) => t.id === opts.where.id) ?? null;
      if (ctorName === 'GatheringGroupTeam') {
        return (
          data.links?.find(
            (l) => l.teamId === opts.where.teamId && l.repartitionId === opts.where.repartitionId,
          ) ?? null
        );
      }
      return null;
    }),
    find: vi.fn(async (entity: { name?: string }) => {
      const ctorName = (entity as unknown as { name: string }).name;
      if (ctorName === 'GatheringGroup') return data.groups ?? [];
      if (ctorName === 'GatheringGroupTeam') return data.links ?? [];
      return [];
    }),
    delete: vi.fn(async () => undefined),
    save: vi.fn(async (_e: unknown, payload: unknown) => payload),
    create: vi.fn((_e: unknown, payload: unknown) => payload),
  };
  const dataSource = {
    transaction: vi.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
    query: vi.fn(async (q: string, params: unknown[]) => {
      if (q.includes('FROM teams t')) {
        const ids = (params[0] as number[]) ?? [];
        return ids.map((id) => {
          const size = data.sizes?.[id] ?? { jeunes: 6, animateurs: 1 };
          return { id, jeunes: String(size.jeunes), animateurs: String(size.animateurs) };
        });
      }
      return [];
    }),
  };
  const service = new GatheringGroupsService(
    {
      findOneBy: vi.fn(async ({ id }: { id: number }) => (id === rep.id ? rep : null)),
      find: vi.fn(async () => [rep]),
      create: vi.fn((p: unknown) => p),
      save: vi.fn(async (p: unknown) => p),
      remove: vi.fn(async () => undefined),
    } as never,
    {
      findOneBy: vi.fn(
        async ({ id }: { id: number }) => data.groups?.find((g) => g.id === id) ?? null,
      ),
      find: vi.fn(async () => data.groups ?? []),
      findOne: vi.fn(async () => null),
      create: vi.fn((p: unknown) => p),
      save: vi.fn(async (p: unknown) => p),
      remove: vi.fn(async () => undefined),
    } as never,
    sequenceLinks as never,
    {
      find: vi.fn(async ({ where }: { where?: { repartitionId?: number; groupId?: number } }) =>
        (data.links ?? []).filter(
          (l) =>
            (where?.repartitionId == null || l.repartitionId === where.repartitionId) &&
            (where?.groupId == null || l.groupId === where.groupId),
        ),
      ),
      delete: vi.fn(async () => undefined),
    } as never,
    { find: vi.fn(async () => []), findOneBy: vi.fn(async () => null), create: vi.fn((p: unknown) => p), save: vi.fn(async (p: unknown) => p), delete: vi.fn(async () => undefined) } as never,
    { delete: vi.fn(async () => undefined) } as never,
    {
      find: vi.fn(async () => data.teams ?? []),
    } as never,
    { findOneBy: vi.fn(async ({ id }: { id: number }) => (data.sequenceIds?.includes(id) ? { id } : null)) } as never,
    { findOneBy: vi.fn(async () => null) } as never,
    dataSource as never,
  );
  return { service, manager, sequenceLinks };
};

describe('règle des pistes (TA / ES / mixte)', () => {
  it('un groupe TA ou ES n accepte que sa piste, un groupe mixte accepte tout', () => {
    expect(GatheringGroupsService.trackAllowed(GatheringGroupCategory.TA, ProgramSequenceTrack.TA)).toBe(true);
    expect(GatheringGroupsService.trackAllowed(GatheringGroupCategory.TA, ProgramSequenceTrack.ES)).toBe(false);
    expect(GatheringGroupsService.trackAllowed(GatheringGroupCategory.TA, ProgramSequenceTrack.COMMON)).toBe(false);
    expect(GatheringGroupsService.trackAllowed(GatheringGroupCategory.ES, ProgramSequenceTrack.ES)).toBe(true);
    expect(GatheringGroupsService.trackAllowed(GatheringGroupCategory.ES, ProgramSequenceTrack.TA)).toBe(false);
    expect(GatheringGroupsService.trackAllowed(GatheringGroupCategory.MIXTE, ProgramSequenceTrack.TA)).toBe(true);
    expect(GatheringGroupsService.trackAllowed(GatheringGroupCategory.MIXTE, ProgramSequenceTrack.ES)).toBe(true);
    expect(GatheringGroupsService.trackAllowed(GatheringGroupCategory.MIXTE, ProgramSequenceTrack.COMMON)).toBe(true);
  });

  it('refuse l affectation d une équipe d une autre piste', async () => {
    const { service } = build({
      groups: [group(1, { category: GatheringGroupCategory.TA })],
      teams: [team(7, ProgramSequenceTrack.ES)],
    });
    await expect(service.assignTeam(1, 7, ALL)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('dispatch : une équipe entière, un seul groupe par répartition', () => {
  it('refuse une équipe déjà placée dans un autre groupe de la même répartition', async () => {
    const { service } = build({
      groups: [group(1), group(2)],
      teams: [team(7, ProgramSequenceTrack.TA)],
      links: [{ groupId: 2, teamId: 7, repartitionId: 1 }],
    });
    await expect(service.assignTeam(1, 7, ALL)).rejects.toBeInstanceOf(ConflictException);
  });

  it('accepte l affectation quand la capacité suffit', async () => {
    const { service } = build({
      groups: [group(1, { capacityPersons: 10 })],
      teams: [team(7, ProgramSequenceTrack.TA)],
      sizes: { 7: { jeunes: 6, animateurs: 1 } },
    });
    await expect(service.assignTeam(1, 7, ALL)).resolves.toEqual({ assigned: true });
  });

  it('bloque le dépassement de capacité par défaut', async () => {
    const { service } = build({
      groups: [group(1, { capacityPersons: 6 })],
      teams: [team(7, ProgramSequenceTrack.TA)],
      sizes: { 7: { jeunes: 6, animateurs: 1 } }, // 7 personnes, animateur compris
    });
    await expect(service.assignTeam(1, 7, ALL)).rejects.toBeInstanceOf(ConflictException);
  });

  it('compte sans les animateurs quand le comptage les exclut', async () => {
    const { service } = build({
      repartition: repartition({ countAnimators: false }),
      groups: [group(1, { capacityPersons: 6 })],
      teams: [team(7, ProgramSequenceTrack.TA)],
      sizes: { 7: { jeunes: 6, animateurs: 1 } },
    });
    await expect(service.assignTeam(1, 7, ALL)).resolves.toEqual({ assigned: true });
  });

  it('autorise le dépassement quand la dérogation est activée', async () => {
    const { service } = build({
      repartition: repartition({ allowOverflow: true }),
      groups: [group(1, { capacityPersons: 6 })],
      teams: [team(7, ProgramSequenceTrack.TA)],
      sizes: { 7: { jeunes: 6, animateurs: 1 } },
    });
    await expect(service.assignTeam(1, 7, ALL)).resolves.toEqual({ assigned: true });
  });
});

describe('portée « ses groupes »', () => {
  it('un responsable ne voit que ses groupes (404 ailleurs)', async () => {
    const { service } = build({ groups: [group(1), group(2)] });
    await expect(service.assignTeam(1, 7, SCOPED([2]))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('la création de répartition exige la portée « tout »', async () => {
    const { service } = build({});
    await expect(
      service.createRepartition({ name: 'Test' }, SCOPED([1])),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe('proposition automatique', () => {
  it('remplit les groupes compatibles sans couper les équipes, grosses d abord', async () => {
    const { service } = build({
      groups: [
        group(1, { category: GatheringGroupCategory.TA, capacityPersons: 16 }),
        group(2, { category: GatheringGroupCategory.ES, capacityPersons: 8 }),
      ],
      teams: [
        team(11, ProgramSequenceTrack.TA, 'TA grosse'),
        team(12, ProgramSequenceTrack.TA, 'TA petite'),
        team(13, ProgramSequenceTrack.ES, 'ES une'),
        team(14, ProgramSequenceTrack.ES, 'ES trop grosse'),
      ],
      sizes: {
        11: { jeunes: 8, animateurs: 2 }, // 10
        12: { jeunes: 5, animateurs: 1 }, // 6
        13: { jeunes: 6, animateurs: 1 }, // 7
        14: { jeunes: 9, animateurs: 1 }, // 10 > 8
      },
    });
    const out = await service.propose(1, ALL);
    // Ordre : 14 (10, ES) ne rentre pas ; 11 (10, TA) et 12 (6, TA) dans le groupe 1 ; 13 (7, ES) dans le groupe 2.
    expect(out.assignments).toEqual([
      { teamId: 11, groupId: 1, groupName: 'Groupe 1' },
      { teamId: 13, groupId: 2, groupName: 'Groupe 2' },
      { teamId: 12, groupId: 1, groupName: 'Groupe 1' },
    ]);
    expect(out.unplaced).toEqual([
      {
        teamId: 14,
        teamName: 'ES trop grosse',
        reason: 'Capacité insuffisante dans les groupes compatibles',
      },
    ]);
  });

  it('ne propose rien dans un groupe d une autre piste', async () => {
    const { service } = build({
      groups: [group(1, { category: GatheringGroupCategory.ES, capacityPersons: 30 })],
      teams: [team(11, ProgramSequenceTrack.TA)],
    });
    const out = await service.propose(1, ALL);
    expect(out.assignments).toEqual([]);
    expect(out.unplaced).toEqual([
      { teamId: 11, teamName: 'Équipe 11', reason: 'Aucun groupe de sa piste' },
    ]);
  });
});

describe('application en une transaction', () => {
  it('refuse une équipe listée deux fois', async () => {
    const { service } = build({ groups: [group(1)], teams: [team(7, ProgramSequenceTrack.TA)] });
    await expect(
      service.apply(1, { assignments: [{ teamId: 7, groupId: 1 }, { teamId: 7, groupId: 1 }] }, ALL),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un groupe hors de la répartition', async () => {
    const { service } = build({ groups: [group(1)], teams: [team(7, ProgramSequenceTrack.TA)] });
    await expect(
      service.apply(1, { assignments: [{ teamId: 7, groupId: 99 }] }, ALL),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('contrôle la capacité sur l état final, pas équipe par équipe', async () => {
    const { service } = build({
      groups: [group(1, { capacityPersons: 10 }), group(2, { capacityPersons: 10 })],
      teams: [team(7, ProgramSequenceTrack.TA), team(8, ProgramSequenceTrack.ES)],
      links: [{ groupId: 1, teamId: 7, repartitionId: 1 }],
      sizes: { 7: { jeunes: 6, animateurs: 1 }, 8: { jeunes: 6, animateurs: 1 } },
    });
    // Déplacer 7 vers le groupe 2 et ajouter 8 au groupe 1 : chaque groupe reste ≤ 10.
    await expect(
      service.apply(
        1,
        { assignments: [{ teamId: 7, groupId: 2 }, { teamId: 8, groupId: 1 }] },
        ALL,
      ),
    ).resolves.toEqual({ applied: 2 });
  });
});

describe('liens groupe <-> créneau (plusieurs-à-plusieurs)', () => {
  it('lie un seul groupe à un créneau, sans toucher aux autres groupes', async () => {
    const { service, sequenceLinks } = build({ groups: [group(1), group(2)], sequenceIds: [50] });
    await expect(service.linkSequence(1, 50, ALL)).resolves.toEqual({ linked: true, already: false });
    expect(sequenceLinks.save).toHaveBeenCalledTimes(1);
    expect(sequenceLinks.save).toHaveBeenCalledWith({ groupId: 1, programSequenceId: 50 });
  });

  it('refuse un créneau inconnu', async () => {
    const { service } = build({ groups: [group(1)] });
    await expect(service.linkSequence(1, 99, ALL)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('retire le lien d un groupe pour un créneau précis seulement', async () => {
    const { service, sequenceLinks } = build({ groups: [group(1)], sequenceIds: [50, 51] });
    await service.unlinkSequence(1, 50, ALL);
    expect(sequenceLinks.delete).toHaveBeenCalledWith({ groupId: 1, programSequenceId: 50 });
  });

  it('un compte limité à ses groupes ne lie pas un autre groupe', async () => {
    const { service } = build({ groups: [group(1), group(2)], sequenceIds: [50] });
    await expect(service.linkSequence(2, 50, SCOPED([1]))).rejects.toBeInstanceOf(NotFoundException);
  });
});
