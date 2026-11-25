import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { PROGRAM_EVENT_DAYS } from '../schedule-chain.util';
import { ProgrammeJournalPage } from './programme-journal';

const DAY = PROGRAM_EVENT_DAYS[0];
const OTHER_DAY = PROGRAM_EVENT_DAYS[2];

const ENTRIES = [
  {
    id: 1,
    action: 'INSERT',
    eventDate: DAY,
    authorUserId: 1,
    authorUserName: 'coordination@allegria.local',
    createdAt: '2027-10-31T08:00:00.000Z',
    affectedSequenceIds: [2],
    comment: 'Créneau ajouté',
  },
  {
    id: 2,
    action: 'FREEZE',
    eventDate: OTHER_DAY,
    authorUserId: 1,
    authorUserName: null,
    createdAt: '2027-11-02T09:00:00.000Z',
    affectedSequenceIds: [5],
    comment: null,
  },
];

function setup() {
  TestBed.configureTestingModule({
    imports: [ProgrammeJournalPage],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(ProgrammeJournalPage);
  fixture.detectChanges();
  const component = fixture.componentInstance;
  const flush = () => http.expectOne('/api/program/change-log').flush(ENTRIES);
  return { component, http, flush };
}

describe('ProgrammeJournalPage', () => {
  it('charge le journal complet et le filtre par jour', () => {
    const { component, http, flush } = setup();
    flush();

    expect(component.entries()).toHaveLength(2);
    expect(component.filtered()).toHaveLength(2);

    component.setDayFilter(0);
    expect(component.filtered().map((entry) => entry.id)).toEqual([1]);

    component.setDayFilter(2);
    expect(component.filtered().map((entry) => entry.id)).toEqual([2]);

    component.setDayFilter(null);
    expect(component.filtered()).toHaveLength(2);
    http.verify();
  });

  it('compte les entrées par jour pour les pastilles de filtre', () => {
    const { component, http, flush } = setup();
    flush();

    expect(component.dayCount(0)).toBe(1);
    expect(component.dayCount(1)).toBe(0);
    expect(component.dayCount(2)).toBe(1);
    http.verify();
  });

  it('signale un échec de chargement sans bloquer la page', () => {
    const { component, http } = setup();
    http.expectOne('/api/program/change-log').flush('erreur', {
      status: 500,
      statusText: 'Server Error',
    });

    expect(component.loading()).toBe(false);
    expect(component.loadError()).toBe(true);
    http.verify();
  });
});
