import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { VolunteerTeam } from '../../models/models';
import {
  VolunteerTeamsApiService,
  VolunteerTeamTypesApiService,
} from '../../services/api.services';
import { VolunteerTeamsPage } from './volunteer-teams';

const team: VolunteerTeam = {
  id: 1,
  name: 'Liturgie',
  code: 'LITURGIE',
  description: 'Service liturgique',
  isActive: true,
  createdAt: '2027-07-01T00:00:00.000Z',
  updatedAt: '2027-07-02T00:00:00.000Z',
};

describe('VolunteerTeamsPage', () => {
  it('charge les equipes et ouvre le formulaire de creation', async () => {
    const api = {
      list: vi.fn(() => of([team])),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const typesApi = {
      list: vi.fn(() =>
        of([
          {
            id: 7,
            code: 'SECURITE',
            label: 'Sécurité',
            description: null,
            sortOrder: 10,
            isActive: true,
          },
        ]),
      ),
      create: vi.fn(() => of({})),
      update: vi.fn(() => of({})),
      delete: vi.fn(() => of({ deleted: true })),
    };

    await TestBed.configureTestingModule({
      imports: [VolunteerTeamsPage],
      providers: [
        { provide: VolunteerTeamsApiService, useValue: api },
        { provide: VolunteerTeamTypesApiService, useValue: typesApi },
        { provide: AuthService, useValue: { hasAnyRole: () => true } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VolunteerTeamsPage);
    fixture.componentInstance.ngOnInit();
    await fixture.whenStable();

    expect(fixture.componentInstance.items()).toEqual([team]);

    fixture.componentInstance.create();
    expect(fixture.componentInstance.opened()).toBe(true);
    expect(fixture.componentInstance.mode()).toBe('create');
    expect(fixture.componentInstance.model().typeId).toBeNull();

    fixture.componentInstance.setType(7);
    expect(fixture.componentInstance.model().typeId).toBe(7);
    fixture.componentInstance.setType(0);
    expect(fixture.componentInstance.model().typeId).toBeNull();
    expect(fixture.componentInstance.types().length).toBe(1);
  });
});
