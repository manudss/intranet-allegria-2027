import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, convertToParamMap } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PersonHistoryPage, HistoryPerson } from './person-history.page';
import { DetailReportApi, DetailFilters } from './detail-report-api.service';
const person: HistoryPerson = {
  participantId: 42,
  volunteerId: null,
  firstName: 'Ada',
  lastName: null,
  type: 'JEUNE',
};
function make(params = {}) {
  const http = {
    get: vi.fn((url: string, options: { params: HttpParams }) => { void url; void options; return of({ items: [person], total: 51 }); }),
  };
  const api = {
    points: vi.fn(() => of([])),
    types: vi.fn(() => of([])),
    events: vi.fn((filters: DetailFilters) => {
      void filters;
      return of({ items: [], total: 52, fetchedAt: '2026-11-13T11:00Z' });
    }),
  };
  TestBed.configureTestingModule({
    imports: [PersonHistoryPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(params) } },
      },
      { provide: HttpClient, useValue: http },
      { provide: DetailReportApi, useValue: api },
    ],
  });
  const fixture = TestBed.createComponent(PersonHistoryPage);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, http, api };
}
afterEach(() => TestBed.resetTestingModule());
describe('Personal scan history', () => {
  it('searches even without a selected passage or a badge and pages server-side', () => {
    const { c, http } = make();
    c.search = 'Ada';
    c.searchPeople();
    expect(http.get).toHaveBeenLastCalledWith(
      '/api/access-control/reporting/people',
      expect.objectContaining({ params: expect.anything() }),
    );
    expect(http.get.mock.calls.at(-1)?.[1].params.get('q')).toBe('Ada');
    c.searchPage(1);
    expect(http.get.mock.calls.at(-1)?.[1].params.get('offset')).toBe('50');
  });
  it('loads every verdict for a selected participant, not badge or previous page filters', () => {
    const { c, api } = make();
    c.choose(person);
    expect(api.events).toHaveBeenLastCalledWith(
      expect.objectContaining({ participantId: 42, limit: 50, offset: 0 }),
    );
    expect(api.events.mock.calls.at(-1)?.[0]).not.toHaveProperty('verdict');
    c.page(1);
    expect(api.events).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 50 }));
    c.verdictFilter = 'DUPLICATE';
    c.refresh();
    expect(api.events).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 0, verdict: 'DUPLICATE' }),
    );
  });
  it('handles a volunteer with no participant without creating a projection or loading another history', () => {
    const { c, api, fixture } = make();
    c.choose({ ...person, participantId: null, volunteerId: 3, type: 'BENEVOLE' });
    fixture.detectChanges();
    expect(api.events).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Cette consultation ne crée aucune fiche');
  });
  it('opens a direct participant link without inheriting dashboard filters', () => {
    const { api } = make({ participantId: '42', pointId: '99', verdict: 'DUPLICATE' });
    expect(api.events).toHaveBeenLastCalledWith(expect.objectContaining({ participantId: 42 }));
    expect(api.events.mock.calls.at(-1)?.[0]).not.toHaveProperty('pointId');
    expect(api.events.mock.calls.at(-1)?.[0]).not.toHaveProperty('verdict');
  });
  it('retains loaded rows and their original page index when the next page fails', () => {
    const { c, api } = make();
    c.choose(person);
    api.events.mockReturnValue(throwError(() => Error('network')));
    c.page(1);
    expect(c.events()?.total).toBe(52);
    expect(c.resultOffset()).toBe(0);
    expect(c.error()).toContain('périmées');
  });
  it('rejects invalid date ranges without requests', () => {
    const { c, api } = make();
    c.choose(person);
    api.events.mockClear();
    c.from = '';
    c.refresh();
    expect(api.events).not.toHaveBeenCalled();
    expect(c.error()).toContain('période');
  });
  it('cancels outstanding history when closing or selecting an unprojected volunteer', () => {
    const { c, api } = make();
    const pending = new Subject();
    api.events.mockReturnValue(pending as never);
    c.choose(person);
    expect(pending.observed).toBe(true);
    c.close();
    expect(pending.observed).toBe(false);
    expect(c.selected()).toBeNull();
    c.choose(person);
    c.choose({ ...person, participantId: null, volunteerId: 3 });
    expect(pending.observed).toBe(false);
  });
});
