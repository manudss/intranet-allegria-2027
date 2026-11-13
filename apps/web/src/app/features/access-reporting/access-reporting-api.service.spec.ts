import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect } from 'vitest';
import { AccessReportingApi } from './access-reporting-api.service';
describe('AccessReportingApi real endpoint contract',()=>{
  it('sends explicit filters and a review note to the API, never raw SQL or QR data',()=>{
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
    const api=TestBed.inject(AccessReportingApi),http=TestBed.inject(HttpTestingController);
    api.summary({from:'2027-07-31T00:00:00Z',to:'2027-08-01T00:00:00Z',zoneId:1,entryTypeId:2,exitTypeId:3}).subscribe();
    const s=http.expectOne(r=>r.url==='/api/access-control/reporting/summary');expect(s.request.params.get('zoneId')).toBe('1');expect(s.request.params.get('entryTypeId')).toBe('2');s.flush({});
    api.reviews(undefined,50).subscribe();const r=http.expectOne(r=>r.url==='/api/access-control/reporting/reviews');expect(r.request.params.get('offset')).toBe('50');expect(r.request.params.has('zoneId')).toBe(false);r.flush({items:[],total:0});
    api.closeReview(7,'Checked both devices').subscribe();const c=http.expectOne('/api/access-control/reporting/reviews/7/close');expect(c.request.method).toBe('POST');expect(c.request.body).toEqual({note:'Checked both devices'});c.flush({});http.verify();
  });
});
