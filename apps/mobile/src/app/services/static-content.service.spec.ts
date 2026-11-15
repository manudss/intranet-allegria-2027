import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StaticContentService } from './static-content.service';

describe('StaticContentService — programme public', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return {
      service: TestBed.inject(StaticContentService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('lit l’instantané publié depuis la route publique de l’API', () => {
    const { service, http } = setup();
    let result: unknown;
    service.getPublicProgramDay('2027-10-31').subscribe((day) => (result = day));
    http.expectOne('/api/public/program/2027-10-31').flush({
      date: '2027-10-31',
      updatedAt: '2027-10-30T20:00:00.000Z',
      sequences: [{ title: 'Veillée', startTime: '21:00', endTime: '22:00', location: 'Chapelle' }],
    });
    expect(result).toEqual(jasmineLike());
    http.verify();

    function jasmineLike() {
      return {
        date: '2027-10-31',
        updatedAt: '2027-10-30T20:00:00.000Z',
        sequences: [{ title: 'Veillée', startTime: '21:00', endTime: '22:00', location: 'Chapelle' }],
      };
    }
  });

  it('retombe sur le fichier statique si l’API est injoignable', () => {
    const { service, http } = setup();
    let result: { date: string } | undefined;
    service.getPublicProgramDay('2027-10-31').subscribe((day) => (result = day));
    http.expectOne('/api/public/program/2027-10-31').error(new ProgressEvent('offline'));
    http.expectOne('/content/program-2027-10-31.json').flush({
      date: '2027-10-31',
      updatedAt: '2027-10-01T00:00:00.000Z',
      sequences: [],
    });
    expect(result?.date).toBe('2027-10-31');
    http.verify();
  });
});
