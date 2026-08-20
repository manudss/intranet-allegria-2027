import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { HostFamiliesApiService, AssignmentsApiService } from '../../services/api.services';
import { HostFamiliesMapPageComponent } from './host-families-map-page';

const families = [
  {
    id: 1,
    familyName: 'Famille Nord',
    address: '12 rue A',
    postalCode: '69001',
    city: 'Lyon',
    phone: null,
    email: null,
    maxCapacity: 6,
    maxUnder18: 4,
    parish: 'Nord',
    notes: null,
    latitude: 45.8,
    longitude: 4.84,
    maxAnimators: 2,
    constraints: [],
    tags: ['jardin'],
    status: 'VALIDATED',
  },
  {
    id: 2,
    familyName: 'Famille Sud',
    address: '14 rue B',
    postalCode: '69002',
    city: 'Lyon',
    phone: null,
    email: null,
    maxCapacity: 3,
    maxUnder18: 1,
    parish: 'Sud',
    notes: null,
    latitude: 45.65,
    longitude: 4.84,
    maxAnimators: 1,
    constraints: [],
    tags: ['chien'],
    status: 'DRAFT',
  },
] as const;

const assignments = [
  {
    id: 10,
    participant: {} as never,
    hostFamily: families[0],
    arrivalDate: '2027-07-19',
    departureDate: '2027-07-27',
    status: 'CONFIRMED',
    notes: null,
    type: 'ANIMATEUR',
    groupId: null,
    roomLabel: null,
  },
] as const;

describe('HostFamiliesMapPageComponent', () => {
  it('applique les filtres sur les familles affichees', async () => {
    const hostApi = { list: vi.fn(() => of(families)) };
    const assignmentApi = { list: vi.fn(() => of(assignments)) };

    await TestBed.configureTestingModule({
      imports: [HostFamiliesMapPageComponent],
      providers: [
        { provide: HostFamiliesApiService, useValue: hostApi },
        { provide: AssignmentsApiService, useValue: assignmentApi },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostFamiliesMapPageComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    await fixture.whenStable();

    expect(component.filteredFamilies().length).toBe(2);
    component.filters.patchValue({ animatorLabel: 'Avec animateurs' });
    await new Promise((resolve) => setTimeout(resolve, 320));
    expect(component.filteredFamilies().length).toBe(1);
    expect(component.filteredFamilies()[0].family.id).toBe(1);
  });

  it('met a jour selectedFamilyId au clic marker et card', async () => {
    const hostApi = { list: vi.fn(() => of(families)) };
    const assignmentApi = { list: vi.fn(() => of(assignments)) };

    await TestBed.configureTestingModule({
      imports: [HostFamiliesMapPageComponent],
      providers: [
        { provide: HostFamiliesApiService, useValue: hostApi },
        { provide: AssignmentsApiService, useValue: assignmentApi },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostFamiliesMapPageComponent);
    const component = fixture.componentInstance;
    component.onMarkerSelected(2);
    expect(component.selectedFamilyId()).toBe(2);
    component.onCardSelected(1);
    expect(component.selectedFamilyId()).toBe(1);
  });
});
