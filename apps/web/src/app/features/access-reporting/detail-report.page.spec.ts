import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, convertToParamMap } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DetailReportPage } from './detail-report.page';
import { DetailReportApi } from './detail-report-api.service';
const dashboard = {
  points: [],
  totals: {
    scannedPeople: 3,
    accepted: 4,
    rejected: 2,
    duplicates: 1,
    needsReview: 1,
    attempts: 8,
    lastReceivedAt: null,
  },
  fetchedAt: '2026-11-13T14:00Z',
  caveat: '',
};
function make(mode = 'dashboard') {
  const api = {
    expected: vi.fn(() =>
      of({ passages: [], slots: [], fetchedAt: '2026-11-13T14:00Z', membershipBasis: 'CURRENT' }),
    ),
    points: vi.fn(() => of([{ id: 1, name: 'Porte', active: true, zoneId: 1 }])),
    zones: vi.fn(() => of([])),
    types: vi.fn(() => of([])),
    teams: vi.fn(() => of([])),
    dashboard: vi.fn(() => of(dashboard)),
    events: vi.fn(() => of({ items: [], total: 52 })),
    scanned: vi.fn(() => of({ items: [], total: 52 })),
  };
  TestBed.configureTestingModule({
    imports: [DetailReportPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { data: { mode }, queryParamMap: convertToParamMap({ pointId: '1' }) },
        },
      },
      { provide: DetailReportApi, useValue: api },
    ],
  });
  const fixture = TestBed.createComponent(DetailReportPage);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, api };
}
afterEach(() => {
  TestBed.resetTestingModule();
  vi.useRealTimers();
});
describe('Validated detail reporting screens', () => {
  it('loads current expected groups separately from attempts and transmits service filters', () => {
    const { c, api } = make();
    expect(api.expected).toHaveBeenCalled();
    c.serviceKey = 'midi';
    c.refresh();
    expect(api.expected).toHaveBeenLastCalledWith(expect.objectContaining({ serviceKey: 'midi' }));
    expect(c.pointsWithoutExpected()).toEqual([]);
  });
  it('does not request expected-group overview on the per-place screen', () => {
    const { api } = make('place');
    expect(api.expected).not.toHaveBeenCalled();
  });
  it('requests bounded anomalies and keeps distinct counters separate', () => {
    const { api, fixture } = make();
    expect(api.events).toHaveBeenLastCalledWith(
      expect.objectContaining({ anomaliesOnly: 'true', limit: 10, offset: 0 }),
    );
    expect(fixture.nativeElement.textContent).toContain('Personnes scannées');
    expect(fixture.nativeElement.textContent).toContain('pas un décompte');
  });
  it('separates accepted persons, attempts and review server filters', () => {
    const { c, api } = make('place');
    expect(api.scanned).toHaveBeenLastCalledWith(
      expect.objectContaining({ pointId: 1, limit: 50, offset: 0 }),
    );
    c.switchMode('review');
    expect(api.events).toHaveBeenLastCalledWith(expect.objectContaining({ reviewOnly: 'true' }));
    c.switchMode('events');
    expect(api.events).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ reviewOnly: 'true' }),
    );
  });
  it('pages by 50 and resets to first page on filter changes', () => {
    const { c, api } = make('place');
    c.page(1);
    expect(api.scanned).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 50 }));
    c.search = 'Ada';
    c.refresh();
    expect(api.scanned).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0, q: 'Ada' }));
  });
  it('does not automatically apply unfinished filter edits', () => {
    const { c, api } = make();
    api.dashboard.mockClear();
    c.search = 'draft';
    c.autoRefresh();
    expect(api.dashboard).not.toHaveBeenCalled();
    c.search = '';
    c.autoRefresh();
    expect(api.dashboard).toHaveBeenCalledTimes(1);
  });
  it('keeps last data and its page offset with an explicit stale warning', () => {
    const { c, api } = make('place');
    api.scanned.mockReturnValue(throwError(() => Error('network')));
    c.page(1);
    expect(c.dashboard()?.totals.scannedPeople).toBe(3);
    expect(c.resultOffset()).toBe(0);
    expect(c.error()).toContain('pas actualisées');
  });
  it('rejects invalid dates before issuing requests', () => {
    const { c, api } = make();
    api.dashboard.mockClear();
    c.from = '';
    c.refresh();
    expect(api.dashboard).not.toHaveBeenCalled();
    expect(c.error()).toContain('période');
  });
  it('does not overlap timer refresh with an outstanding request and cleans up', () => {
    vi.useFakeTimers();
    const { c, api, fixture } = make();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    api.dashboard.mockReturnValue(new Subject() as never);
    c.refresh();
    const count = api.dashboard.mock.calls.length;
    vi.advanceTimersByTime(30000);
    expect(api.dashboard.mock.calls.length).toBe(count);
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
