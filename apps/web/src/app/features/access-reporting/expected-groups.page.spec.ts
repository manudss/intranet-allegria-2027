import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ExpectedGroupsPage } from './expected-groups.page';
import { ExpectedGroupsApi, SaveGroup, SavePassage } from './expected-groups-api.service';
import { DetailReportApi } from './detail-report-api.service';
const group = {
  id: 2,
  name: 'Repas TA',
  version: 3,
  archived_at: null,
  sources: [{ teamId: 8, label: 'Équipe A' }],
};
function make() {
  const api = {
    groups: vi.fn(() => of({ items: [group], total: 1 })),
    group: vi.fn(() => of(group)),
    members: vi.fn(() => of({ items: [], total: 25 })),
    passages: vi.fn(() => of({ items: [], total: 0 })),
    people: vi.fn(() => of({ items: [], total: 0 })),
    save: vi.fn((id: number | null, dto: SaveGroup) =>
      of({ ...group, ...dto, id: id ?? 3, version: 4 }),
    ),
    savePassage: vi.fn((id: number | null, dto: SavePassage) => {
      void dto;
      return of({ id: id ?? 1 });
    }),
  };
  const config = {
    teams: vi.fn(() => of([{ id: 8, name: 'Équipe A' }])),
    points: vi.fn(() =>
      of([
        { id: 1, name: 'Réfectoire', active: true, scanTypeId: 3, serviceKey: 'midi', zoneId: 1 },
      ]),
    ),
    types: vi.fn(() => of([])),
  };
  TestBed.configureTestingModule({
    imports: [ExpectedGroupsPage],
    providers: [
      provideRouter([]),
      { provide: ExpectedGroupsApi, useValue: api },
      { provide: DetailReportApi, useValue: config },
    ],
  });
  const fixture = TestBed.createComponent(ExpectedGroupsPage);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, api };
}
afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});
describe('Validated group composition management', () => {
  it('guards navigation and browser close with unsaved or pending work', () => {
    const { c } = make();
    c.dirty.set(true);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(c.canDeactivate()).toBe(false);
    const event = { preventDefault: vi.fn(), returnValue: undefined };
    c.warnBeforeUnload(event as unknown as BeforeUnloadEvent);
    expect(event.preventDefault).toHaveBeenCalled();
    c.dirty.set(false);
    c.saving.set(true);
    expect(c.canDeactivate()).toBe(false);
  });
  it('asks before discarding an unsaved passage', () => {
    const { c } = make();
    c.choose(2);
    c.editPassage(null);
    c.passageDirty.set(true);
    c.passageLabel = 'En cours';
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    c.closePassage();
    expect(c.editorOpen()).toBe(true);
    c.choose(null);
    expect(c.group()?.id).toBe(2);
    expect(c.passageLabel).toBe('En cours');
  });
  it('keeps unique source keys and sends the existing version for a save', () => {
    const { c, api } = make();
    c.choose(2);
    c.add({ teamId: 8 });
    c.add({ personType: 'JEUNE' });
    c.add({ personType: 'JEUNE' });
    expect(c.sources).toHaveLength(2);
    expect(c.dirty()).toBe(true);
    c.save();
    expect(api.save).toHaveBeenLastCalledWith(
      2,
      expect.objectContaining({ version: 3, sources: [{ teamId: 8 }, { personType: 'JEUNE' }] }),
    );
    expect(c.dirty()).toBe(false);
    expect(c.group()?.version).toBe(4);
  });
  it('marks saved member totals as not including pending composition edits', () => {
    const { c, fixture } = make();
    c.choose(2);
    c.add({ personType: 'ANIMATEUR' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('pas le brouillon');
    expect(c.members().total).toBe(25);
  });
  it('preserves source edits after conflicts, and asks before reloading', () => {
    const { c, api } = make();
    c.choose(2);
    c.name = 'Nouvelle composition';
    c.edited();
    api.save.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    c.save();
    expect(c.name).toBe('Nouvelle composition');
    expect(c.dirty()).toBe(true);
    expect(c.error()).toContain('autre session');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    c.reload();
    expect(c.name).toBe('Nouvelle composition');
  });
  it('reuses a volunteer identity without creating participant or badge', () => {
    const { c } = make();
    c.addPerson({
      participantId: null,
      volunteerId: 3,
      firstName: 'Camille',
      lastName: 'Exemple',
      type: 'BENEVOLE',
      personKey: 'volunteer:3',
    });
    expect(c.sources).toEqual([{ volunteerId: 3 }]);
  });
  it('derives passage service/type from the point and saves Paris instants', () => {
    const { c, api } = make();
    c.choose(2);
    c.editPassage(null);
    c.passagePointId = 1;
    c.passageLabel = 'Midi';
    c.startsAt = '2027-07-31T12:00';
    c.endsAt = '2027-07-31T14:00';
    c.savePassage();
    expect(api.savePassage).toHaveBeenLastCalledWith(
      null,
      expect.objectContaining({
        groupId: 2,
        pointId: 1,
        scanTypeId: 3,
        serviceKey: 'midi',
        startsAt: '2027-07-31T10:00:00.000Z',
        endsAt: '2027-07-31T12:00:00.000Z',
        timezone: 'Europe/Paris',
      }),
    );
  });
  it('blocks passage writes for unsaved group composition, archived groups, invalid range and inactive points', () => {
    const { c, api } = make();
    c.choose(2);
    c.editPassage(null);
    c.passagePointId = 1;
    c.passageLabel = 'Midi';
    c.startsAt = '2027-07-31T14:00';
    c.endsAt = '2027-07-31T12:00';
    c.savePassage();
    expect(api.savePassage).not.toHaveBeenCalled();
    c.edited();
    c.savePassage();
    expect(c.passageError()).toContain('composition');
    c.dirty.set(false);
    c.archived = true;
    c.savePassage();
    expect(c.passageError()).toContain('Réactivez');
    c.archived = false;
    c.points[0].active = false;
    c.savePassage();
    expect(c.passageError()).toContain('point actif');
  });
  it('does not overlap group saves and disables selection during the pending write', () => {
    const { c, api } = make();
    c.choose(2);
    const pending = new Subject();
    api.save.mockReturnValue(pending as never);
    c.save();
    c.save();
    c.choose(null);
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(c.group()?.id).toBe(2);
  });
});
