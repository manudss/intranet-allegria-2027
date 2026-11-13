import {provideRouter} from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { AccessReportingPage, reportFilters } from './access-reporting.page';
import { AccessReportingApi, AccessSummary, ScanReviewItem } from './access-reporting-api.service';
const row:ScanReviewItem={id:7,participantId:42,firstName:'Ada',lastName:'Test',verdict:'DUPLICATE',needsReview:false,occurredAtLocal:'2027-07-31T12:00:00Z',receivedAt:'2027-07-31T12:01:00Z',pointId:3,pointName:'Repas midi',zoneId:1};
const summary:AccessSummary={from:'2027-07-31T00:00:00Z',to:'2027-08-01T00:00:00Z',zoneId:null,counts:[{zoneId:1,zoneName:'Repas',scanTypeId:3,scanTypeLabel:'Repas',serviceKey:'midi',accepted:215,uncertain:4,duplicates:2,rejected:1}],presence:{estimatedPresent:248,byZone:[{zoneId:1,present:248}]},pendingReviews:3,lastReceivedAt:'2027-07-31T12:42:00Z',fetchedAt:'2027-07-31T12:43:00Z',caveat:''};
function setup() {
  const api={zones:vi.fn(()=>of([{id:1,name:'Repas'}])),types:vi.fn(()=>of([{id:1,code:'ENTREE',label:'Entrée'},{id:2,code:'SORTIE',label:'Sortie'},{id:3,code:'REPAS',label:'Repas'}])),summary:vi.fn(()=>of(summary)),reviews:vi.fn(()=>of({items:[row],total:51})),closeReview:vi.fn(()=>of({}))};
  TestBed.configureTestingModule({imports:[AccessReportingPage],providers:[provideRouter([]),{provide:AccessReportingApi,useValue:api}]});
  const fixture=TestBed.createComponent(AccessReportingPage);fixture.detectChanges();
  return {api,fixture,page:fixture.componentInstance};
}
describe('AccessReportingPage',()=>{
  it('matches the three counters and renders real review data without counting ambiguous meals',()=>{
    const {fixture,page}=setup();const text=fixture.nativeElement.textContent;
    expect(text).toContain('Présence estimée');expect(text).toContain('248');expect(text).toContain('215');expect(text).toContain('Ada Test');expect(text).toContain('Repas midi');expect(text).toContain("pas un décompte d'évacuation");expect(page.meals()).toBe(215);
  });
  it('applies zone, inclusive local dates, explicit scan types, and resets pagination',()=>{
    const {api,page}=setup();page.zoneId=1;page.from='2027-07-31';page.to='2027-07-31';page.offset.set(50);page.refresh();
    expect(page.offset()).toBe(0);expect(api.summary).toHaveBeenLastCalledWith(reportFilters('2027-07-31','2027-07-31',1,1,2));expect(api.reviews).toHaveBeenLastCalledWith(1,0);
    page.page(1);expect(api.reviews).toHaveBeenLastCalledWith(1,50);
  });
  it('does not guess unknown custom scan types',()=>{
    const {page,api}=setup();api.types.mockReturnValue(of([{id:9,code:'CUSTOM',label:'Repas visuel'}]));page.configure();
    expect(page.entryTypeId).toBeNull();expect(page.mealTypeId).toBeNull();expect(page.meals()).toBeNull();
  });
  it('rejects invalid periods and mismatched movement types before requests',()=>{
    for(const [from,to] of [['2027-08-02','2027-08-01'],['2027-01-01','2027-03-01'],['','2027-08-01']]) expect(()=>reportFilters(from,to,null,null,null)).toThrow();
    expect(()=>reportFilters('2027-07-31','2027-07-31',null,1,1)).toThrow();expect(()=>reportFilters('2027-07-31','2027-07-31',null,1,null)).toThrow();
  });
  it('hides stale counters on failed refresh rather than showing zero or stale values',()=>{
    const {api,page}=setup();api.summary.mockReturnValue(throwError(()=>new Error('network')));page.refresh();expect(page.summary()).toBeNull();expect(page.error()).toContain('Chargement impossible');expect(page.loading()).toBe(false);
  });
  it('closes with a note, blocks duplicate submit and reloads without modifying original verdict',()=>{
    const {api,page}=setup();const pending=new Subject<object>();api.closeReview.mockReturnValue(pending);page.examine(row);page.note='  Checked both devices  ';page.closeReview();page.closeReview();
    expect(api.closeReview).toHaveBeenCalledTimes(1);expect(api.closeReview).toHaveBeenCalledWith(7,'Checked both devices');expect(page.saving()).toBe(true);pending.next({});pending.complete();expect(page.selected()).toBeNull();expect(page.notice()).toContain('conservé');expect(row.verdict).toBe('DUPLICATE');
  });
  it('preserves note after an unconfirmed close and permits safe retry',()=>{
    const {api,page}=setup();api.closeReview.mockReturnValue(throwError(()=>new Error('network')));page.examine(row);page.note='Verified';page.closeReview();expect(page.note).toBe('Verified');expect(page.selected()?.id).toBe(7);expect(page.saving()).toBe(false);expect(page.reviewError()).toContain('non confirmée');
  });
});
