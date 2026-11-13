import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AccessAuditPage, ACCESS_AUDIT_ACTIONS } from './access-audit.page';
import { AccessControlApiService } from './access-control-api.service';
describe('AccessAuditPage API contract', () => {
  it('renders actual entity and details fields and uses real action enum', async () => {
    TestBed.configureTestingModule({ imports: [AccessAuditPage], providers: [{ provide: AccessControlApiService, useValue: { audit: () => of({ total: 1, items: [{ id: 1, action: 'BADGE_REPLACED', userId: 2, entityType: 'access_badge_assignments', entityId: 9, details: { participantId: 42 }, createdAt: '2027-07-31T12:00:00Z' }] }) } }] });
    const fixture = TestBed.createComponent(AccessAuditPage); fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('access_badge_assignments'); expect(text).toContain('participantId'); expect(text).toContain('42');
    expect(ACCESS_AUDIT_ACTIONS).toContain('BADGE_STOCK_ADDED'); expect(ACCESS_AUDIT_ACTIONS).toContain('CONFIG_CHANGED');
    expect(ACCESS_AUDIT_ACTIONS).not.toContain('SCAN_UPLOADED');
    fixture.componentInstance.offset.set(50); fixture.componentInstance.filterChanged(); expect(fixture.componentInstance.offset()).toBe(0);
  });
});
