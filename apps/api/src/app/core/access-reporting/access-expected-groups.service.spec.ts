import { describe, it, expect, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AccessExpectedGroupsService } from './access-expected-groups.service';
import { SaveExpectedGroupDto, SaveExpectedPassageDto } from './access-expected-groups.types';
describe('Expected groups management', () => {
  it('filters passage rows and count by the exact same group with bounded pagination', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ total: 3 }])
      .mockResolvedValueOnce([]);
    const s = new AccessExpectedGroupsService({
      transaction: (_isolation: unknown, f: (m: unknown) => unknown) => f({ query }),
    } as never);
    const result = await s.passages({ groupId: 8, limit: 50, offset: 100 });
    expect(result).toEqual({ items: [], total: 3 });
    expect(query.mock.calls[0][1]).toEqual([8]);
    expect(query.mock.calls[1][1]).toEqual([8, 50, 100]);
    expect(query.mock.calls[1][0]).toContain('x.group_id=$1');
  });
  it('resolves the exact passage for deep links and rejects a missing passage', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ id: 9 }])
      .mockResolvedValueOnce([]);
    const s = new AccessExpectedGroupsService({ query } as never);
    expect(await s.passage(9)).toEqual({ id: 9 });
    await expect(s.passage(99)).rejects.toThrow('introuvable');
  });
  it('requires exactly one source and a nonblank name before write', async () => {
    const transaction = vi.fn();
    const s = new AccessExpectedGroupsService({ transaction } as never);
    await expect(s.saveGroup(null, { name: ' ', sources: [] }, 1)).rejects.toThrow();
    await expect(
      s.saveGroup(null, { name: 'Repas', sources: [{ teamId: 2, participantId: 4 }] }, 1),
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
  it('rejects stale group versions before deleting sources', async () => {
    const query = vi.fn().mockResolvedValueOnce([{ id: 1, version: 3 }]);
    const s = new AccessExpectedGroupsService({
      transaction: (fn: (m: unknown) => unknown) => fn({ query }),
    } as never);
    await expect(s.saveGroup(1, { name: 'Repas', sources: [], version: 2 }, 1)).rejects.toThrow(
      'changé',
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('requires existing active point with exact service and type', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ active: true, scan_type_id: 2, service_key: 'midi' }]);
    const s = new AccessExpectedGroupsService({
      transaction: (fn: (m: unknown) => unknown) => fn({ query }),
    } as never);
    await expect(
      s.savePassage(
        null,
        {
          groupId: 1,
          pointId: 3,
          scanTypeId: 2,
          serviceKey: 'soir',
          label: 'Repas',
          startsAt: '2027-07-31T10:00:00Z',
          endsAt: '2027-07-31T12:00:00Z',
          timezone: 'Europe/Paris',
        },
        1,
      ),
    ).rejects.toThrow('correspondre');
  });
  it('rejects bad time zones, ranges, sources and excessive payloads', async () => {
    const transaction = vi.fn();
    const s = new AccessExpectedGroupsService({ transaction } as never);
    const dto = {
      groupId: 1,
      pointId: 1,
      scanTypeId: 1,
      label: 'Repas',
      startsAt: '2027-07-31T10:00:00Z',
      endsAt: '2027-07-31T12:00:00Z',
      timezone: 'Bad/Zone',
    };
    await expect(s.savePassage(null, dto, 1)).rejects.toThrow('Fuseau');
    await expect(s.savePassage(null, { ...dto, endsAt: dto.startsAt }, 1)).rejects.toThrow(
      'Fenêtre',
    );
    expect(
      (
        await validate(
          plainToInstance(SaveExpectedGroupDto, { name: 'G', sources: [{ teamId: -1 }] }),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (await validate(plainToInstance(SaveExpectedPassageDto, { ...dto, groupId: 0 }))).length,
    ).toBeGreaterThan(0);
    expect(transaction).not.toHaveBeenCalled();
  });
});
