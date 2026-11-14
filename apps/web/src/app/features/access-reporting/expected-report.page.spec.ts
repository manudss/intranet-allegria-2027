import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ExpectedReportPage } from './expected-report.page';
import { ExpectedReportApi } from './expected-report-api.service';
const page = {
  items: [],
  total: 0,
  counts: { expected: 26, confirmed: 21, reviewOnly: 1, notConfirmed: 4, exceptions: 1 },
  membershipBasis: 'CURRENT',
};
function make(mode = 'missing', params = {}, linkFailure = false) {
  const api = {
    passages: vi.fn().mockReturnValue(
      of({
        items: [
          {
            id: 4,
            groupName: 'Repas TA',
            label: 'Midi',
            starts_at: '2027-07-31T10:00:00Z',
            ends_at: '2027-07-31T12:00:00Z',
            pointName: 'Réfectoire',
            timezone: 'Europe/Paris',
          },
        ],
        total: 1,
      }),
    ),
    passage: vi
      .fn()
      .mockReturnValue(
        linkFailure
          ? throwError(() => Error('missing'))
          : of({
              id: 999,
              groupName: 'Autre groupe',
              label: 'Autre passage',
              starts_at: '2027-07-31T10:00:00Z',
              ends_at: '2027-07-31T12:00:00Z',
              timezone: 'Europe/Paris',
              pointName: 'Autre point',
            }),
      ),
    status: vi.fn().mockReturnValue(of(page)),
  };
  TestBed.configureTestingModule({
    imports: [ExpectedReportPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { data: { mode }, queryParamMap: convertToParamMap(params) } },
      },
      { provide: ExpectedReportApi, useValue: api },
    ],
  });
  const fixture = TestBed.createComponent(ExpectedReportPage);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, api };
}
afterEach(() => TestBed.resetTestingModule());
describe('Expected reporting V5 screens', () => {
  it('loads an exact linked passage beyond the first list page, never a fallback', () => {
    const { c, api } = make('missing', { passageId: '999' });
    expect(api.passage).toHaveBeenCalledWith(999);
    expect(api.status).toHaveBeenLastCalledWith(999, '', 0, '');
    expect(c.selected()?.id).toBe(999);
  });
  it('does not silently substitute the first passage for an inaccessible link', () => {
    const { c, api } = make('missing', { passageId: '999' }, true);
    expect(api.status).not.toHaveBeenCalled();
    expect(c.error()).toContain('Aucun passage de remplacement');
  });
  it('shows disjoint counts and fetches only 50 rows on the chosen server filter', () => {
    const { c, api, fixture } = make();
    expect(c.result()?.counts.expected).toBe(26);
    c.selectStatus('NOT_CONFIRMED');
    expect(api.status).toHaveBeenLastCalledWith(4, 'NOT_CONFIRMED', 0, '');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('4 sans passage');
  });
  it('formats passage timestamps in the passage timezone rather than the browser timezone', () => {
    const { c } = make();
    expect(c.time('2027-07-31T10:44:00Z')).toContain('12:44');
    expect(c.time(null)).toBe('Heure indisponible');
  });
  it('defaults the group page to exception members', () => {
    const { c, api } = make('groups');
    expect(c.groupsView).toBe(true);
    expect(api.status).toHaveBeenLastCalledWith(4, 'EXCEPTION', 0, '');
  });
  it('retains a visible stale warning on network failure, not zero counts', () => {
    const { c, api } = make();
    api.status.mockReturnValue(throwError(() => new Error('network')));
    c.refresh();
    expect(c.error()).toContain('dernières données');
    expect(c.result()?.counts.expected).toBe(26);
  });
  it('clears previous passage rows when the chosen passage changes', () => {
    const { c, api } = make();
    api.status.mockReturnValue(throwError(() => new Error('network')));
    c.passageId = 5;
    c.changePassage();
    expect(c.result()).toBeNull();
  });
});
