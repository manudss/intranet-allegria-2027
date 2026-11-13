import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GroupHistoryPage } from './group-history.page';
import { DetailReportApi, DetailFilters } from './detail-report-api.service';
const history = {
  group: { id: 2, name: 'Équipe A', archivedAt: null },
  counts: {
    members: 52,
    scannedPeople: 50,
    withoutAccepted: 2,
    attempts: 60,
    accepted: 55,
    rejected: 2,
    duplicates: 2,
    needsReview: 1,
  },
  items: [],
  total: 52,
  membershipBasis: 'CURRENT',
  fetchedAt: '2026-11-13T11:00Z',
};
function make() {
  const http = {
    get: vi.fn((url: string, options: { params: HttpParams }) => {
      void options;
      return of(url.endsWith('/groups') ? { items: [history.group], total: 1 } : history);
    }),
  };
  const api = {
    points: vi.fn(() => of([])),
    events: vi.fn((filters: DetailFilters) => {
      void filters;
      return of({ items: [], total: 60, fetchedAt: history.fetchedAt });
    }),
  };
  TestBed.configureTestingModule({
    imports: [GroupHistoryPage],
    providers: [
      provideRouter([]),
      { provide: HttpClient, useValue: http },
      { provide: DetailReportApi, useValue: api },
    ],
  });
  const fixture = TestBed.createComponent(GroupHistoryPage);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, http, api };
}
afterEach(() => TestBed.resetTestingModule());
describe('Current group history', () => {
  it('requires a deliberate group choice and queries bounded groups independently', () => {
    const { c, http, api } = make();
    expect(api.events).not.toHaveBeenCalled();
    expect(http.get.mock.calls[0][1].params.get('limit')).toBe('50');
    c.groupSearch = 'TA';
    c.findGroups();
    expect(http.get.mock.calls.at(-1)?.[1].params.get('q')).toBe('TA');
  });
  it('does not apply the journal verdict filter to accepted-member counts', () => {
    const { c, http, api, fixture } = make();
    c.groupId = 2;
    c.verdictFilter = 'DUPLICATE';
    c.choose();
    fixture.detectChanges();
    expect(api.events).toHaveBeenLastCalledWith(
      expect.objectContaining({ expectedGroupId: 2, verdict: 'DUPLICATE', limit: 50 }),
    );
    expect(http.get.mock.calls.at(-1)?.[1].params.has('verdict')).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Composition actuelle');
    expect(fixture.nativeElement.textContent).toContain('exception liée à un passage');
  });
  it('requests server-side missing members and omits the journal request for member tabs', () => {
    const { c, http, api } = make();
    c.groupId = 2;
    c.choose();
    api.events.mockClear();
    c.switchTab('missing');
    expect(api.events).not.toHaveBeenCalled();
    expect(http.get.mock.calls.at(-1)?.[1].params.get('withoutAcceptedOnly')).toBe('true');
    c.page(1);
    expect(http.get.mock.calls.at(-1)?.[1].params.get('offset')).toBe('50');
    c.switchTab('members');
    expect(http.get.mock.calls.at(-1)?.[1].params.get('withoutAcceptedOnly')).toBe('false');
    expect(http.get.mock.calls.at(-1)?.[1].params.get('offset')).toBe('0');
  });
  it('retains the loaded page on a failed refresh with an explicit warning', () => {
    const { c, api } = make();
    c.groupId = 2;
    c.choose();
    api.events.mockReturnValue(throwError(() => Error('network')));
    c.page(1);
    expect(c.history()?.counts.members).toBe(52);
    expect(c.resultOffset()).toBe(0);
    expect(c.error()).toContain('périmées');
  });
  it('clears old group rows and cancels requests when a new group is selected', () => {
    const { c, api } = make();
    c.groupId = 2;
    c.choose();
    const pending = new Subject();
    api.events.mockReturnValue(pending as never);
    c.refresh();
    expect(pending.observed).toBe(true);
    c.groupId = null;
    c.choose();
    expect(pending.observed).toBe(false);
    expect(c.history()).toBeNull();
    expect(c.events()).toBeNull();
  });
  it('rejects invalid periods before querying', () => {
    const { c, api } = make();
    c.groupId = 2;
    c.from = '';
    c.refresh();
    expect(api.events).not.toHaveBeenCalled();
    expect(c.error()).toContain('période');
  });
});
