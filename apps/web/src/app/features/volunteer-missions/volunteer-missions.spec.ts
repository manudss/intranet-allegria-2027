import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import {
  VolunteerMission,
  VolunteerMissionStatus,
  VolunteerShift,
  VolunteerShiftAssignmentStatus,
  VolunteerShiftStatus,
  VolunteerTeam,
} from '../../models/models';
import {
  VolunteerMissionsApiService,
  VolunteerShiftAssignmentsApiService,
  VolunteerTeamsApiService,
} from '../../services/api.services';
import { VolunteerMissionsPage } from './volunteer-missions';

const team: VolunteerTeam = {
  id: 1,
  name: 'Accueil',
  code: 'ACCUEIL',
  description: null,
  isActive: true,
  createdAt: '2027-07-01T00:00:00.000Z',
  updatedAt: '2027-07-01T00:00:00.000Z',
};

const shift: VolunteerShift = {
  id: 10,
  missionId: 1,
  startAt: '2027-07-24T08:00:00.000Z',
  endAt: '2027-07-24T12:00:00.000Z',
  location: 'Porte Ouest',
  capacity: 4,
  status: VolunteerShiftStatus.TODO,
  isOptional: false,
  notes: null,
  createdAt: '2027-07-01T00:00:00.000Z',
  updatedAt: '2027-07-01T00:00:00.000Z',
  assignments: [],
  activeAssignmentsCount: 0,
  confirmedAssignmentsCount: 0,
};

const mission: VolunteerMission = {
  id: 1,
  title: 'Accueil bus',
  description: null,
  volunteerTeamId: team.id,
  volunteerTeam: team,
  location: 'Porte Ouest',
  responsibleVolunteerId: null,
  responsibleVolunteer: null,
  status: VolunteerMissionStatus.TODO,
  isOptional: false,
  createdAt: '2027-07-01T00:00:00.000Z',
  updatedAt: '2027-07-01T00:00:00.000Z',
  shifts: [shift],
};

describe('VolunteerMissionsPage', () => {
  it('charge missions et shifts et expose les labels d affectation', async () => {
    await TestBed.configureTestingModule({
      imports: [VolunteerMissionsPage],
      providers: [
        {
          provide: VolunteerMissionsApiService,
          useValue: {
            listFiltered: vi.fn(() => of([mission])),
            listShifts: vi.fn(() => of([shift])),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            changeStatus: vi.fn(),
            createShift: vi.fn(),
            updateShift: vi.fn(),
            changeShiftStatus: vi.fn(),
            deleteShift: vi.fn(),
          },
        },
        {
          provide: VolunteerShiftAssignmentsApiService,
          useValue: {
            searchVolunteers: vi.fn(() => of([])),
            create: vi.fn(),
            changeStatus: vi.fn(),
            cancel: vi.fn(),
            listForShift: vi.fn(() => of([])),
            listVolunteerPlanning: vi.fn(() => of([])),
          },
        },
        { provide: VolunteerTeamsApiService, useValue: { list: vi.fn(() => of([team])) } },
        { provide: AuthService, useValue: { hasAnyRole: () => true } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VolunteerMissionsPage);
    fixture.componentInstance.ngOnInit();
    await fixture.whenStable();

    expect(fixture.componentInstance.missions()).toEqual([mission]);
    expect(
      fixture.componentInstance.assignmentStatusLabel(VolunteerShiftAssignmentStatus.CONFIRMED),
    ).toBe('Confirmée');
  });
});

