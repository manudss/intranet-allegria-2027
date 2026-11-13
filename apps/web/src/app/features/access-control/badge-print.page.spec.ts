import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { BadgePrintPage } from './badge-print.page';
import { BadgePrintApi, PoolPerson } from './badge-print-api.service';
import { AccessControlApiService } from './access-control-api.service';
const ada: PoolPerson = {
  id: 1,
  key: 'p:1',
  kind: 'participant',
  firstName: 'Ada',
  lastName: null,
  type: 'JEUNE',
  mejAgeGroup: 'TA',
  teamId: null,
};
const emma: PoolPerson = {
  id: 1,
  key: 'v:1',
  kind: 'volunteer',
  firstName: 'Emma',
  lastName: 'Démo',
  type: 'BENEVOLE',
  teamId: null,
};
const prep = {
  items: [{ ...ada, badgeId: 7, code: '0123456789abcdef0123456789abcdef' }],
  created: 1,
  reused: 0,
};
function setup() {
  const api = {
    youthFilters: vi.fn(() =>
      of({ groups: [], cities: [], dioceses: [], ageGroups: ['TA', 'ES'] }),
    ),
    volunteerFilters: vi.fn(() => of({ poles: [], skills: [], tags: [] })),
    people: vi.fn(async () => ({ items: [ada], total: 1 })),
    preview: vi.fn(() => of(prep)),
    prepare: vi.fn(() => of(prep)),
  };
  const stock = {
    listBadges: vi.fn(() =>
      of({ items: [{ id: 7, code: 'opaque', lot: 'A', status: 'AVAILABLE' }], total: 1 }),
    ),
    registerStock: vi.fn((...args: [string, string[]]) => {
      void args;
      return of({});
    }),
  };
  TestBed.configureTestingModule({
    imports: [BadgePrintPage],
    providers: [
      provideRouter([]),
      { provide: BadgePrintApi, useValue: api },
      { provide: AccessControlApiService, useValue: stock },
    ],
  });
  const fixture = TestBed.createComponent(BadgePrintPage);
  const page = fixture.componentInstance;
  vi.spyOn(page, 'renderCodes').mockImplementation(async () => {
    page.images.set(page.cards().map(() => 'data:image/svg+xml,x'));
  });
  return { api, stock, fixture, page };
}
describe('Badge print pool', () => {
  it('accumulates across types, deduplicates using kind+id, and creates nothing while selecting', async () => {
    const { page, api } = setup();
    page.add(ada);
    page.add(ada);
    page.setKind('volunteer');
    page.add(emma);
    expect(page.pool()).toHaveLength(2);
    expect(api.prepare).not.toHaveBeenCalled();
    expect(api.preview).not.toHaveBeenCalled();
    page.remove(ada);
    expect(page.pool()).toEqual([emma]);
  });
  it('fetches a read-only recap before explicit generation, protects double-clicks and reuses response metadata', async () => {
    const { page, api } = setup();
    page.add(ada);
    await page.review();
    expect(api.preview).toHaveBeenCalledWith([ada]);
    expect(api.prepare).not.toHaveBeenCalled();
    expect(page.step()).toBe(2);
    const pending = new Subject<typeof prep>();
    api.prepare.mockReturnValue(pending);
    const first = page.generate();
    void page.generate();
    expect(api.prepare).toHaveBeenCalledTimes(1);
    pending.next(prep);
    pending.complete();
    await first;
    expect(page.prepared()).toBe(true);
    expect(page.cards()[0].mejAgeGroup).toBe('TA');
    await page.generate();
    expect(api.prepare).toHaveBeenCalledTimes(1);
  });
  it('does not discard selection on uncertain generation and allows safe retry', async () => {
    const { page, api } = setup();
    page.add(ada);
    await page.review();
    api.prepare.mockReturnValue(throwError(() => new Error('timeout')));
    await page.generate();
    expect(page.pool()).toEqual([ada]);
    expect(page.prepared()).toBe(false);
    expect(page.error()).toContain('non confirmée');
    api.prepare.mockReturnValue(of(prep));
    await page.generate();
    expect(page.prepared()).toBe(true);
  });
  it('invalidates a prepared sheet when the pool changes', async () => {
    const { page } = setup();
    page.add(ada);
    await page.review();
    await page.generate();
    page.add(emma);
    expect(page.prepared()).toBe(false);
    expect(page.cards()).toEqual([]);
    expect(page.recap()).toBeNull();
  });
  it('never silently caps a large Add all and leaves the pool unchanged', async () => {
    const { page, api } = setup();
    api.people.mockResolvedValue({
      items: Array.from({ length: 101 }, (_, i) => ({ ...ada, id: i + 1, key: `p:${i + 1}` })),
      total: 101,
    });
    await page.addAll();
    expect(page.pool()).toEqual([]);
    expect(page.error()).toContain('Aucun ajout partiel');
  });
  it('ignores stale search responses and preserves the cross-search pool', async () => {
    const { page, api } = setup();
    let resolve: (value: { items: PoolPerson[]; total: number }) => void = () => undefined;
    api.people
      .mockReturnValueOnce(new Promise((r) => (resolve = r)))
      .mockResolvedValueOnce({ items: [emma], total: 1 });
    const old = page.find();
    page.kind.set('volunteer');
    await page.find();
    resolve({ items: [ada], total: 1 });
    await old;
    expect(page.results()).toEqual([emma]);
  });
  it('forwards all assignment filters and uses explicit pagination', async () => {
    const { page, api } = setup();
    page.search = 'Ada';
    page.type = 'JEUNE';
    page.city = 'Lyon';
    page.groupId = 2;
    page.diocese = 'Lyon';
    page.assignment = 'assigned';
    await page.find();
    await page.find(true);
    expect(api.people).toHaveBeenLastCalledWith(
      'participant',
      expect.objectContaining({
        search: 'Ada',
        type: 'JEUNE',
        city: 'Lyon',
        groupId: 2,
        diocese: 'Lyon',
        assignment: 'assigned',
        offset: 1,
        limit: 100,
      }),
    );
  });
  it('retains generated stock codes for idempotent retry after an uncertain response', async () => {
    const { page, stock } = setup();
    page.lot = 'TEST';
    page.quantity = 2;
    stock.registerStock.mockReturnValueOnce(throwError(() => new Error('timeout')));
    await page.createStock();
    const codes = stock.registerStock.mock.calls[0][1];
    expect(page.pendingStock()).toBe(true);
    page.quantity = 99;
    await page.createStock();
    expect(stock.registerStock.mock.calls[1]).toEqual(['TEST', codes]);
    expect(page.pendingStock()).toBe(false);
  });
  it('revalidates assignments immediately before printing and refuses stale codes', async () => {
    const { page, api } = setup();
    page.add(ada);
    await page.review();
    await page.generate();
    api.preview.mockReturnValue(of({ ...prep, items: [{ ...prep.items[0], code: 'changed' }] }));
    await page.print();
    expect(page.error()).toContain('changé');
    expect(page.busy()).toBe(false);
  });
  it('does not print lost/revoked badges and rechecks current stock before preparing', async () => {
    const { page, stock } = setup();
    page.toggleStock({ id: 7, code: 'opaque', lot: 'A', status: 'AVAILABLE', createdAt: '' });
    stock.listBadges.mockReturnValue(
      of({ items: [{ id: 7, code: 'opaque', lot: 'A', status: 'REVOKED' }], total: 1 }),
    );
    await page.reviewStock();
    expect(page.error()).toContain('révoqué');
    expect(page.prepared()).toBe(false);
  });
});
