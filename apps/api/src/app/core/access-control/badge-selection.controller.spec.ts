import { describe, expect, it, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import {
  BadgeSelectionController,
  SelectPrintParticipantsQuery,
  SelectPrintVolunteersQuery,
} from './badge-selection.controller';
import { PreparePrintDto } from './badge-print.controller';

describe('Printing selection reuses assignment semantics without writes', () => {
  it('passes the real youth/animator filters to the existing privacy-safe selector', async () => {
    const jeunes = {
      searchParticipants: vi
        .fn()
        .mockResolvedValue({
          total: 1,
          participants: [{ id: 1, firstName: 'Ada', lastName: null }],
        }),
      repartitionFilters: vi.fn().mockResolvedValue({ groups: [] }),
    };
    const controller = new BadgeSelectionController(jeunes as never, {} as never);
    const query = {
      search: 'Ada',
      type: 'JEUNE',
      city: 'Lyon',
      diocese: 'Lyon',
      groupId: 2,
      assignment: 'assigned',
      limit: 100,
      offset: 0,
    } as SelectPrintParticipantsQuery;
    expect(await controller.participants(query)).toEqual({
      total: 1,
      participants: [{ id: 1, firstName: 'Ada', lastName: null }],
    });
    expect(jeunes.searchParticipants).toHaveBeenCalledWith(query);
    await controller.participantFilters();
    expect(jeunes.repartitionFilters).toHaveBeenCalledOnce();
  });
  it('includes volunteers without participant projections and limits filter metadata to the relevant fields', async () => {
    const volunteers = {
      searchRepartitionVolunteers: vi
        .fn()
        .mockResolvedValue({
          total: 1,
          volunteers: [{ id: 50, firstName: 'Emma', lastName: 'Test', teamId: null }],
        }),
      repartitionFilters: vi
        .fn()
        .mockResolvedValue({
          poles: [{ id: 2, name: 'Accueil' }],
          skills: [],
          tags: [],
          hostingGroups: [{ secret: 'not needed' }],
          groups: [],
        }),
    };
    const controller = new BadgeSelectionController({} as never, volunteers as never);
    const query = {
      poleId: 2,
      tag: 'Accueil',
      assignment: 'unassigned',
      limit: 100,
      offset: 0,
    } as SelectPrintVolunteersQuery;
    expect((await controller.volunteerRows(query)).volunteers[0].id).toBe(50);
    expect(volunteers.searchRepartitionVolunteers).toHaveBeenCalledWith(query);
    expect(await controller.volunteerFilters()).toEqual({
      poles: [{ id: 2, name: 'Accueil' }],
      skills: [],
      tags: [],
    });
  });
  it('validates and bounds every selector query before forwarding it', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const valid = await pipe.transform(
      { limit: '50', offset: '1', groupId: '2', city: 'Lyon' },
      { type: 'query', metatype: SelectPrintParticipantsQuery },
    );
    expect(valid).toMatchObject({ limit: 50, offset: 1, groupId: 2 });
    for (const value of [
      { type: 'BENEVOLE' },
      { limit: 101 },
      { offset: -1 },
      { groupId: 'NaN' },
      { unknown: 'x' },
    ]) {
      await expect(
        pipe.transform(value, { type: 'query', metatype: SelectPrintParticipantsQuery }),
      ).rejects.toThrow();
    }
    await expect(
      pipe.transform({ poleId: 0 }, { type: 'query', metatype: SelectPrintVolunteersQuery }),
    ).rejects.toThrow();
    await expect(
      pipe.transform({ skill: 'invalid' }, { type: 'query', metatype: SelectPrintVolunteersQuery }),
    ).rejects.toThrow();
    const prepare = await pipe.transform(
      { volunteerIds: [7] },
      { type: 'body', metatype: PreparePrintDto },
    );
    expect(prepare).toMatchObject({ participantIds: [], volunteerIds: [7] });
  });
});
