import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { MySpaceApiService } from '../../services/api.services';
import { ShiftAssignment, TeamMembership, Volunteer } from '../../models/models';
import { MySpaceComponent } from './my-space';

const volunteer: Volunteer = {
  id: 7,
  firstName: 'Ben',
  lastName: 'Martin',
  phone: null,
  email: 'ben@example.com',
  team: null,
  isGroupLeader: false,
  notes: null,
};

const assignment = (
  id: number,
  title: string,
  startAt: string,
  status: ShiftAssignment['status'] = 'CONFIRMED',
): ShiftAssignment => ({
  id,
  status,
  notes: null,
  shift: {
    id,
    startAt,
    endAt: startAt,
    location: 'Grande salle',
    mission: { id, title, description: null, location: null },
  },
});

const membership: TeamMembership = {
  id: 2,
  role: 'Responsable',
  startAt: null,
  endAt: null,
  volunteerTeam: { id: 3, name: 'Équipe Déco', code: 'DECO', description: null },
};

const setup = async (
  api: Partial<MySpaceApiService>,
): Promise<ReturnType<typeof TestBed.createComponent<MySpaceComponent>>> => {
  await TestBed.configureTestingModule({
    imports: [MySpaceComponent],
    providers: [provideZonelessChangeDetection(), { provide: MySpaceApiService, useValue: api }],
  }).compileComponents();
  const fixture = TestBed.createComponent(MySpaceComponent);
  fixture.detectChanges();
  return fixture;
};

describe('MySpaceComponent', () => {
  it('affiche missions triées, statuts et équipe', async () => {
    const fixture = await setup({
      getVolunteer: () => of(volunteer),
      getShiftAssignments: () =>
        of([
          assignment(2, 'Veillée', '2027-10-30T21:00:00'),
          assignment(1, 'Accueil', '2027-10-30T12:00:00', 'PROVISIONAL'),
        ]),
      getTeamMemberships: () => of([membership]),
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ben Martin');
    const titles = [...el.querySelectorAll('.mission-head strong')].map((n) =>
      n.textContent?.trim(),
    );
    expect(titles).toEqual(['Accueil', 'Veillée']);
    expect(el.textContent).toContain('Prévisionnel');
    expect(el.textContent).toContain('Confirmé');
    expect(el.textContent).toContain('Équipe Déco');
    expect(el.textContent).toContain('Responsable');
  });

  it('masque les missions annulées', async () => {
    const fixture = await setup({
      getVolunteer: () => of(volunteer),
      getShiftAssignments: () => of([assignment(1, 'Accueil', '2027-10-30T12:00:00', 'CANCELLED')]),
      getTeamMemberships: () => of([]),
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Aucune mission affectée');
  });

  it('affiche un message quand aucun profil bénévole n est rattaché', async () => {
    const fixture = await setup({
      getVolunteer: () => throwError(() => new Error('404')),
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Aucun profil bénévole',
    );
  });
});
