import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { VolunteerAuditAction } from '../../models/models';
import { VolunteerAuditLogsApiService } from '../../services/api.services';
import { VolunteerAuditLogsPage } from './volunteer-audit-logs';

describe('VolunteerAuditLogsPage', () => {
  it('charge la premiere page du journal', async () => {
    const api = {
      list: vi.fn(() =>
        of({
          items: [
            {
              id: 1,
              userId: 3,
              user: { id: 3, email: 'coord@example.org', roles: ['COORDINATOR'] },
              action: VolunteerAuditAction.UPDATE,
              entityType: 'volunteer_shifts',
              entityId: 19,
              beforeData: { status: 'TODO' },
              afterData: { status: 'IN_PROGRESS' },
              createdAt: '2027-07-24T10:00:00.000Z',
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
        }),
      ),
      getActionOptions: vi.fn(() => Object.values(VolunteerAuditAction)),
    };

    await TestBed.configureTestingModule({
      imports: [VolunteerAuditLogsPage],
      providers: [{ provide: VolunteerAuditLogsApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(VolunteerAuditLogsPage);
    await fixture.whenStable();

    expect(api.list).toHaveBeenCalled();
    expect(fixture.componentInstance.items().length).toBe(1);
    expect(fixture.componentInstance.total()).toBe(1);
  });
});
