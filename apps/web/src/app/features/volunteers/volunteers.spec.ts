import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import {
  Volunteer,
  VolunteerSkill,
  VolunteerSkillType,
  VolunteerTag,
  VolunteerTeam,
  VolunteerTeamMembership,
} from '../../models/models';
import {
  VolunteerSkillsApiService,
  VolunteerShiftAssignmentsApiService,
  VolunteerTagsApiService,
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

const skill: VolunteerSkill = {
  id: 10,
  volunteerId: 1,
  skill: VolunteerSkillType.ANIMATION,
  createdAt: '2027-07-01T00:00:00.000Z',
};

const tag: VolunteerTag = {
  id: 20,
  volunteerId: 1,
  value: 'musique',
  createdAt: '2027-07-01T00:00:00.000Z',
};

const makeProviders = (overrides: {
  volunteersApi?: object;
  skillsApi?: object;
  tagsApi?: object;
} = {}) => {
  const volunteersApi = overrides.volunteersApi ?? {
    list: vi.fn(() => of([volunteer])),
    listFiltered: vi.fn(() => of([volunteer])),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const teamsApi = { list: vi.fn(() => of([team])), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const membershipsApi = { list: vi.fn(() => of([membership])), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const skillsApi = overrides.skillsApi ?? {
    list: vi.fn(() => of([skill])),
    add: vi.fn(),
    remove: vi.fn(),
    getCounts: vi.fn(() => of([])),
  };
  const tagsApi = overrides.tagsApi ?? {
    list: vi.fn(() => of([tag])),
    add: vi.fn(),
    remove: vi.fn(),
    getSuggestions: vi.fn(() => of(['musique', 'sport'])),
  };
  return [
    { provide: VolunteersApiService, useValue: volunteersApi },
    { provide: VolunteerTeamsApiService, useValue: teamsApi },
    { provide: VolunteerTeamMembershipsApiService, useValue: membershipsApi },
    { provide: VolunteerSkillsApiService, useValue: skillsApi },
    { provide: VolunteerTagsApiService, useValue: tagsApi },
    { provide: VolunteerShiftAssignmentsApiService, useValue: { listVolunteerPlanning: vi.fn(() => of([])) } },
    { provide: AuthService, useValue: { hasAnyRole: () => true } },
  ];
};

describe('VolunteersPage', () => {
  it('charge les bénévoles et les équipes à l\'init', async () => {
    await TestBed.configureTestingModule({
      imports: [VolunteersPage],
      providers: makeProviders(),
    }).compileComponents();

    const fixture = TestBed.createComponent(VolunteersPage);
    fixture.componentInstance.ngOnInit();
    await fixture.whenStable();

    expect(fixture.componentInstance.teams()).toEqual([team]);
  });

  it('charge les compétences et tags à l\'ouverture d\'une fiche', async () => {
    await TestBed.configureTestingModule({
      imports: [VolunteersPage],
      providers: makeProviders(),
    }).compileComponents();

    const fixture = TestBed.createComponent(VolunteersPage);
    fixture.componentInstance.ngOnInit();
    await fixture.whenStable();

    fixture.componentInstance.open(volunteer);
    await fixture.whenStable();

    expect(fixture.componentInstance.skills()).toEqual([skill]);
    expect(fixture.componentInstance.tags()).toEqual([tag]);
    expect(fixture.componentInstance.teamMemberships()).toEqual([membership]);
  });

  it('ajoute une compétence et rafraîchit la liste', async () => {
    const newSkill: VolunteerSkill = { id: 11, volunteerId: 1, skill: VolunteerSkillType.HEALTH, createdAt: '2027-07-01T00:00:00.000Z' };
    const addFn = vi.fn(() => of(newSkill));
    const skillsApi = {
      list: vi.fn(() => of([skill])),
      add: addFn,
      remove: vi.fn(),
      getCounts: vi.fn(() => of([])),
    };

    await TestBed.configureTestingModule({
      imports: [VolunteersPage],
      providers: makeProviders({ skillsApi }),
    }).compileComponents();

    const fixture = TestBed.createComponent(VolunteersPage);
    fixture.componentInstance.ngOnInit();
    await fixture.whenStable();
    fixture.componentInstance.open(volunteer);
    await fixture.whenStable();

    fixture.componentInstance.newSkill.set(VolunteerSkillType.HEALTH);
    fixture.componentInstance.addSkill();
    await fixture.whenStable();

    expect(addFn).toHaveBeenCalledWith(1, { skill: VolunteerSkillType.HEALTH });
    expect(fixture.componentInstance.skills()).toContainEqual(newSkill);
  });

  it('ajoute un tag et réinitialise la saisie', async () => {
    const newTag: VolunteerTag = { id: 21, volunteerId: 1, value: 'sport', createdAt: '2027-07-01T00:00:00.000Z' };
    const addFn = vi.fn(() => of(newTag));
    const tagsApi = {
      list: vi.fn(() => of([tag])),
      add: addFn,
      remove: vi.fn(),
      getSuggestions: vi.fn(() => of(['musique', 'sport'])),
    };

    await TestBed.configureTestingModule({
      imports: [VolunteersPage],
      providers: makeProviders({ tagsApi }),
    }).compileComponents();

    const fixture = TestBed.createComponent(VolunteersPage);
    fixture.componentInstance.ngOnInit();
    await fixture.whenStable();
    fixture.componentInstance.open(volunteer);
    await fixture.whenStable();

    fixture.componentInstance.newTag.set('sport');
    fixture.componentInstance.addTag();
    await fixture.whenStable();

    expect(addFn).toHaveBeenCalledWith(1, { value: 'sport' });
    expect(fixture.componentInstance.tags()).toContainEqual(newTag);
    expect(fixture.componentInstance.newTag()).toBe('');
  });

  it('filtre les compétences disponibles à l\'ajout', async () => {
    await TestBed.configureTestingModule({
      imports: [VolunteersPage],
      providers: makeProviders(),
    }).compileComponents();

    const fixture = TestBed.createComponent(VolunteersPage);
    fixture.componentInstance.ngOnInit();
    await fixture.whenStable();
    fixture.componentInstance.open(volunteer);
    await fixture.whenStable();

    const available = fixture.componentInstance.availableSkills();
    expect(available).not.toContain(VolunteerSkillType.ANIMATION);
    expect(available).toContain(VolunteerSkillType.HEALTH);
  });
});

