import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
    mission: {
      id,
      title,
      description: null,
      location: null,
      volunteerTeam: { id: 3, name: 'Accueil', code: 'ACC', description: null },
      responsibleVolunteer: { id: 9, firstName: 'Marc', lastName: 'Duret' },
    },
  },
});

const membership: TeamMembership = {
  id: 2,
  role: 'Responsable',
  startAt: null,
  endAt: null,
  volunteerTeam: { id: 3, name: 'Accueil', code: 'ACC', description: null },
};

const setup = async (
  api: Partial<MySpaceApiService>,
): Promise<ReturnType<typeof TestBed.createComponent<MySpaceComponent>>> => {
  await TestBed.configureTestingModule({
    imports: [MySpaceComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: MySpaceApiService, useValue: api },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(MySpaceComponent);
  fixture.detectChanges();
  return fixture;
};

describe('MySpaceComponent', () => {
  it('affiche l accueil, le planning du jour sélectionné et les statuts', async () => {
    const fixture = await setup({
      getVolunteer: () => of(volunteer),
      getShiftAssignments: () =>
        of([
          assignment(2, 'Veillée', '2027-10-31T21:00:00'),
          assignment(1, 'Accueil groupes', '2027-10-31T12:00:00', 'PROVISIONAL'),
        ]),
      getTeamMemberships: () => of([membership]),
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Bonjour Ben');
    expect(el.textContent).toContain('Prochain créneau');
    expect(el.textContent).toContain('prévisionnel');
    const titles = [...el.querySelectorAll('.mission-head strong')].map((n) =>
      n.textContent?.trim(),
    );
    expect(titles).toEqual(['Accueil groupes', 'Veillée']);
    expect(el.textContent).toContain('Prévisionnel');
    expect(el.textContent).toContain('Confirmé');
    expect(el.textContent).toContain('Responsable : Marc Duret');
    expect(el.textContent).toContain('Mes équipes');
    expect(el.textContent).toContain('Mon profil');
  });

  it('filtre les missions par jour et masque les annulées', async () => {
    const fixture = await setup({
      getVolunteer: () => of(volunteer),
      getShiftAssignments: () =>
        of([
          assignment(1, 'Accueil', '2027-10-31T12:00:00'),
          assignment(2, 'Régie', '2027-11-01T19:00:00'),
          assignment(3, 'Annulée', '2027-11-01T08:00:00', 'CANCELLED'),
        ]),
      getTeamMemberships: () => of([]),
    });
    const el = fixture.nativeElement as HTMLElement;
    // J1 (2027-10-31) par défaut
    expect(el.textContent).toContain('Accueil');
    expect(el.textContent).not.toContain('Régie');

    const chips = [...el.querySelectorAll<HTMLButtonElement>('.day-chip')];
    chips[1].click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Régie');
    expect(el.textContent).not.toContain('Annulée');
  });

  it('affiche un état vide quand aucun créneau ce jour-là', async () => {
    const fixture = await setup({
      getVolunteer: () => of(volunteer),
      getShiftAssignments: () => of([]),
      getTeamMemberships: () => of([]),
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Aucun créneau ce jour-là',
    );
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
