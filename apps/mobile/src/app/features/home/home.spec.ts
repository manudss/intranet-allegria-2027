import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { ProgramApiService } from '../../services/api.services';
import { ProgramDay } from '../../models/models';
import { dayOf, seq } from '../program/program.fixture';
import { HomeComponent } from './home';

const setup = async (getDay: () => Observable<ProgramDay>, roles: string[] = ['VOLUNTEERS']) => {
  await TestBed.configureTestingModule({
    imports: [HomeComponent],
    providers: [
      provideRouter([]),
      provideZonelessChangeDetection(),
      {
        provide: AuthService,
        useValue: {
          currentUser: () => ({ id: 1, email: 'ben@example.com', roles }),
          hasAnyRole: (candidates: string[]) => candidates.some((r) => roles.includes(r)),
          logout: () => undefined,
        },
      },
      { provide: ProgramApiService, useValue: { getDay, getChangeLog: () => of([]) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(HomeComponent);
  fixture.detectChanges();
  return fixture;
};

describe('HomeComponent', () => {
  it('affiche les prochaines séquences triées par heure', async () => {
    const fixture = await setup(() => of(dayOf(seq(2, '14:30'), seq(1, '12:00'))));
    const times = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.next-item .time'),
    ].map((el) => el.textContent?.trim());
    expect(times).toEqual(['12:00', '14:30']);
  });

  it('affiche un message quand le programme est indisponible', async () => {
    const fixture = await setup(() => throwError(() => new Error('offline')));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Programme indisponible',
    );
  });

  it('affiche la tuile « Mon espace » pour un compte bénévole', async () => {
    const fixture = await setup(() => of(dayOf(seq(1, '12:00'))), ['VOLUNTEERS']);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Mon espace');
  });

  it('masque la tuile « Mon espace » sans rôle autorisé', async () => {
    const fixture = await setup(() => of(dayOf(seq(1, '12:00'))), ['ANIMATOR']);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Mon espace');
  });
});
