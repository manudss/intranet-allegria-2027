import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import {
  Volunteer,
  VolunteerTeam,
  VolunteerTeamMembership,
} from '../../models/models';
import {
  VolunteerTeamMembershipsApiService,
  VolunteerTeamsApiService,
  VolunteersApiService,
} from '../../services/api.services';
import { VolunteersPage } from './volunteers';

const volunteer: Volunteer = {
  id: 1,
  user: null,
  firstName: 'Paul',
  lastName: 'Martin',
  phone: null,
  email: 'paul@example.org',
  team: null,
  isGroupLeader: false,
  notes: null,
};

const team: VolunteerTeam = {
  id: 2,
  name: 'Liturgie',
  code: 'LITURGIE',
  description: null,
  isActive: true,
  createdAt: '2027-07-01T00:00:00.000Z',
  updatedAt: '2027-07-01T00:00:00.000Z',
};

const membership: VolunteerTeamMembership = {
  id: 7,
  volunteerId: 1,
  volunteerTeamId: 2,
  volunteer,
  volunteerTeam: team,
  startAt: '2027-07-19',
  endAt: '2027-07-27',
  role: 'Coordination',
  createdAt: '2027-07-01T00:00:00.000Z',
  updatedAt: '2027-07-01T00:00:00.000Z',
};

describe('VolunteersPage', () => {
  it('charge les rattachements dune equipe et prepare le formulaire', async () => {
    const volunteersApi = { list: vi.fn(() => of([volunteer])), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    const teamsApi = { list: vi.fn(() => of([team])), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    const membershipsApi = {
      list: vi.fn(() => of([membership])),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [VolunteersPage],
      providers: [
        { provide: VolunteersApiService, useValue: volunteersApi },
        { provide: VolunteerTeamsApiService, useValue: teamsApi },
        { provide: VolunteerTeamMembershipsApiService, useValue: membershipsApi },
        { provide: AuthService, useValue: { hasAnyRole: () => true } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VolunteersPage);
    fixture.componentInstance.ngOnInit();
    await fixture.whenStable();

    expect(fixture.componentInstance.items()).toEqual([volunteer]);
    expect(fixture.componentInstance.teams()).toEqual([team]);

    fixture.componentInstance.open(volunteer);
    await fixture.whenStable();

    expect(fixture.componentInstance.teamMemberships()).toEqual([membership]);
  });
});
