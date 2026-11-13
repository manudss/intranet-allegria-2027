import { describe, it, expect, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AccessReportingDetailsService } from './access-reporting-details.service';
import { ReportDetailQuery } from './access-reporting-details.types';
import { REPORT_DETAIL_SQL } from './access-reporting-details.sql';
const q = () =>
  Object.assign(new ReportDetailQuery(), {
    from: '2027-07-31T00:00:00Z',
    to: '2027-08-01T00:00:00Z',
  });
describe('Reporting details service', () => {
  it('requires a group and bounded dates before querying group history', async () => {
    const transaction = vi.fn();
    const service = new AccessReportingDetailsService({ transaction } as never);
    await expect(service.groupHistory(q())).rejects.toThrow('Choisissez un groupe');
    await expect(
      service.groupHistory({ ...q(), expectedGroupId: 2, to: '2028-01-01T00:00:00Z' }),
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
  it('keeps group member counters independent of journal verdict and pages missing members on the server', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ id: 2, name: 'Équipe A' }])
      .mockResolvedValueOnce([{ members: 10, withoutAccepted: 2 }])
      .mockResolvedValueOnce([]);
    const transaction = vi.fn((_: unknown, f: (m: unknown) => unknown) => f({ query }));
    const service = new AccessReportingDetailsService({ transaction } as never);
    const result = await service.groupHistory({
      ...q(),
      expectedGroupId: 2,
      verdict: 'DUPLICATE' as never,
      withoutAcceptedOnly: 'true',
      limit: 50,
      offset: 100,
    });
    expect(result).toMatchObject({ total: 2, items: [], membershipBasis: 'CURRENT' });
    expect(query.mock.calls[1][1][10]).toBeNull();
    expect(query.mock.calls[2][1].slice(-3)).toEqual([true, 50, 100]);
    expect(transaction.mock.calls[0][0]).toBe('REPEATABLE READ');
  });
  it('counts empty pages in the same read snapshot, without altering scans', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ total: 12 }])
      .mockResolvedValueOnce([]);
    const transaction = vi.fn((_isolation: unknown, fn: (m: unknown) => unknown) => fn({ query }));
    const s = new AccessReportingDetailsService({ transaction } as never);
    expect(await s.events({ ...q(), offset: 100 })).toMatchObject({
      items: [],
      total: 12,
      limit: 50,
      offset: 100,
      membershipBasis: 'CURRENT',
    });
    expect(transaction.mock.calls[0][0]).toBe('REPEATABLE READ');
    expect(query.mock.calls[0][0]).toBe(REPORT_DETAIL_SQL.eventCount);
  });
  it('applies anomaly and review filters identically to count and rows', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);
    const s = new AccessReportingDetailsService({
      transaction: async (_: unknown, f: (m: unknown) => unknown) => f({ query }),
    } as never);
    await s.events({ ...q(), anomaliesOnly: 'true', reviewOnly: 'true' });
    for (const call of query.mock.calls) {
      expect(call[0]).toContain("e.needs_review OR e.verdict<>'ACCEPTED'");
      expect(call[0]).toContain('AND e.needs_review');
    }
  });
  it('rejects an unbounded date range before any database read', async () => {
    const transaction = vi.fn();
    const s = new AccessReportingDetailsService({ transaction } as never);
    await expect(s.events({ ...q(), to: '2028-01-01T00:00:00Z' })).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
  it('validates bounded pagination, enums and positive identifiers', async () => {
    for (const fields of [
      { limit: 101 },
      { anomaliesOnly: 'yes' },
      { withoutAcceptedOnly: '1' },
      { reviewOnly: '1' },
      { offset: -1 },
      { pointId: 0 },
      { personType: 'ROOT' },
      { verdict: 'OK' },
      { q: 'x'.repeat(121) },
    ]) {
      const errors = await validate(plainToInstance(ReportDetailQuery, { ...q(), ...fields }));
      expect(errors.length).toBeGreaterThan(0);
    }
    expect(
      await validate(plainToInstance(ReportDetailQuery, { ...q(), limit: '50', pointId: '3' })),
    ).toEqual([]);
  });
});
