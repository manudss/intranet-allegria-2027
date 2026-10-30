import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { HostFamily } from '../../models/models';
import { HostFamiliesApiService } from '../../services/api.services';
import { HostingPlacementApiService } from '../hosting-placement/hosting-placement.api';
import { AssignmentsPage, HostFamilyCardsComponent } from './assignments';

const family: HostFamily = {
  id: 1,
  familyName: 'Famille Bernard',
  address: '12 rue des Tilleuls',
  postalCode: '69003',
  city: 'Lyon',
  phone: null,
  email: null,
  maxCapacity: 6,
  maxUnder18: 4,
  parish: 'Sainte Blandine',
  notes: null,
  latitude: null,
  longitude: null,
  maxAnimators: 2,
  constraints: [],
  tags: ['jardin'],
  status: 'VALIDATED',
};

describe('AssignmentsPage', () => {
  it('charge les familles et ouvre le drawer avec les affectations', async () => {
    const api = { list: vi.fn(() => of([family])), getAssignments: vi.fn(() => of([])) };
    await TestBed.configureTestingModule({
      imports: [AssignmentsPage],
      providers: [
        { provide: HostFamiliesApiService, useValue: api },
        { provide: HostingPlacementApiService, useValue: { listGroups: vi.fn(() => of([])) } },
        provideRouter([]),
      ],
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

describe('HostFamilyCardsComponent', () => {
  it('affiche le groupe et coche une carte', async () => {
    await TestBed.configureTestingModule({ imports: [HostFamilyCardsComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostFamilyCardsComponent);
    fixture.componentRef.setInput('families', [{ ...family, hostingGroupId: 3 }]);
    fixture.componentRef.setInput('groupNames', new Map([[3, 'Lyon nord']]));
    const emitted: number[][] = [];
    fixture.componentInstance.checkedChange.subscribe((ids) => emitted.push(ids));
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="card-group-name"]')?.textContent).toContain('Lyon nord');
    (el.querySelector('[data-testid="card-check-1"]') as HTMLInputElement).click();
    expect(emitted).toEqual([[1]]);
  });
});

describe('AssignmentsPage changement de groupe refusé', () => {
  it('affiche le message du serveur (409) et recharge la valeur réellement enregistrée', async () => {
    const api = { list: vi.fn(() => of([family])), getAssignments: vi.fn(() => of([])) };
    const hosting = {
      listGroups: vi.fn(() => of([])),
      setFamilyGroup: vi.fn(() =>
        throwError(() => ({ status: 409, error: { message: 'Famille avec des affectations actives' } })),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [AssignmentsPage],
      providers: [
        { provide: HostFamiliesApiService, useValue: api },
        { provide: HostingPlacementApiService, useValue: hosting },
        provideRouter([]),
      ],
    }).compileComponents();
    const page = TestBed.createComponent(AssignmentsPage).componentInstance;
    page.ngOnInit();
    page.select(family);
    const versionBefore = page.groupVersion();
    const loadsBefore = api.list.mock.calls.length;

    page.changeFamilyGroup(null);

    expect(page.groupError()).toContain('Famille avec des affectations actives');
    expect(page.groupVersion()).toBe(versionBefore + 1);
    expect(api.list.mock.calls.length).toBeGreaterThan(loadsBefore);
  });
});
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { HostFamily } from '../../models/models';
import { HostFamiliesApiService } from '../../services/api.services';
import { HostingPlacementApiService } from '../hosting-placement/hosting-placement.api';
import { AssignmentsPage, HostFamilyCardsComponent } from './assignments';

const family: HostFamily = {
  id: 1,
  familyName: 'Famille Bernard',
  address: '12 rue des Tilleuls',
  postalCode: '69003',
  city: 'Lyon',
  phone: null,
  email: null,
  maxCapacity: 6,
  maxUnder18: 4,
  parish: 'Sainte Blandine',
  notes: null,
  latitude: null,
  longitude: null,
  maxAnimators: 2,
  constraints: [],
  tags: ['jardin'],
  status: 'VALIDATED',
};

describe('AssignmentsPage', () => {
  it('charge les familles et ouvre le drawer avec les affectations', async () => {
    const api = { list: vi.fn(() => of([family])), getAssignments: vi.fn(() => of([])) };
    await TestBed.configureTestingModule({
      imports: [AssignmentsPage],
      providers: [
        { provide: HostFamiliesApiService, useValue: api },
        { provide: HostingPlacementApiService, useValue: { listGroups: vi.fn(() => of([])) } },
        provideRouter([]),
      ],
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

describe('HostFamilyCardsComponent', () => {
  it('affiche le groupe et coche une carte', async () => {
    await TestBed.configureTestingModule({ imports: [HostFamilyCardsComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostFamilyCardsComponent);
    fixture.componentRef.setInput('families', [{ ...family, hostingGroupId: 3 }]);
    fixture.componentRef.setInput('groupNames', new Map([[3, 'Lyon nord']]));
    const emitted: number[][] = [];
    fixture.componentInstance.checkedChange.subscribe((ids) => emitted.push(ids));
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="card-group-name"]')?.textContent).toContain('Lyon nord');
    (el.querySelector('[data-testid="card-check-1"]') as HTMLInputElement).click();
    expect(emitted).toEqual([[1]]);
  });
});
