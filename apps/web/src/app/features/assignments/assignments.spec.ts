import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { HostFamily } from '../../models/models';
import { HostFamiliesApiService } from '../../services/api.services';
import { AssignmentsPage } from './assignments';

const family: HostFamily = {
  id: 1, familyName: 'Famille Bernard', address: '12 rue des Tilleuls', postalCode: '69003', city: 'Lyon',
  phone: null, email: null, maxCapacity: 6, maxUnder18: 4, parish: 'Sainte Blandine', notes: null,
  latitude: null, longitude: null, maxAnimators: 2, constraints: [], tags: ['jardin'], status: 'VALIDATED',
};

describe('AssignmentsPage', () => {
  it('charge les familles et ouvre le drawer avec les affectations', async () => {
    const api = { list: vi.fn(() => of([family])), getAssignments: vi.fn(() => of([])) };
    await TestBed.configureTestingModule({
      imports: [AssignmentsPage],
      providers: [{ provide: HostFamiliesApiService, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(AssignmentsPage);
    fixture.componentInstance.ngOnInit();
    await fixture.whenStable();

    expect(fixture.componentInstance.families()).toEqual([family]);
    fixture.componentInstance.select(family);
    expect(fixture.componentInstance.selectedFamily()).toBe(family);
    expect(api.getAssignments).toHaveBeenCalledWith(1);
  });
});
