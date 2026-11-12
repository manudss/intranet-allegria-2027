import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { MySpaceApiService } from '../../services/api.services';
import { Teammate, TeamMembership } from '../../models/models';
import { MyTeamsComponent } from './my-teams';

const membership: TeamMembership = {
  id: 2,
  role: 'Référent',
  startAt: '2027-10-31',
  endAt: '2027-11-03',
  volunteerTeam: { id: 3, name: 'Régie scène', code: 'REGIE', description: 'Conduite de la grande scène.' },
};

const teammate: Teammate = {
  id: 8,
  role: 'Sonorisation',
  volunteer: {
    id: 13,
    firstName: 'Aline',
    lastName: 'Fabre',
    phone: '+33611223344',
    email: 'aline@example.com',
  },
};

const setup = async (api: Partial<MySpaceApiService>) => {
  await TestBed.configureTestingModule({
    imports: [MyTeamsComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: MySpaceApiService, useValue: api },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(MyTeamsComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
};

describe('MyTeamsComponent', () => {
  it('affiche les équipes avec rôle, période et équipiers contactables', async () => {
    const fixture = await setup({
      getTeamMemberships: () => of([membership]),
      getTeammates: () => of([teammate]),
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Régie scène');
    expect(el.textContent).toContain('Référent');
    expect(el.textContent).toContain('31 oct. 2027');
    expect(el.textContent).toContain('Conduite de la grande scène.');
    expect(el.textContent).toContain('Aline Fabre');
    expect(el.textContent).toContain('Sonorisation');
    expect(el.querySelector('a[href="tel:+33611223344"]')).toBeTruthy();
    expect(el.querySelector('a[href="mailto:aline@example.com"]')).toBeTruthy();
  });

  it('affiche un état vide sans équipe', async () => {
    const fixture = await setup({ getTeamMemberships: () => of([]) });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Pas encore rattaché à une équipe',
    );
  });

  it('tolère une erreur de chargement des équipiers', async () => {
    const fixture = await setup({
      getTeamMemberships: () => of([membership]),
      getTeammates: () => throwError(() => new Error('500')),
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Régie scène');
    expect(el.textContent).toContain("Aucun autre membre pour l'instant");
  });
});
