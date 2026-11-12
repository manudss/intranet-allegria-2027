import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { StaticContentService } from '../../../services/static-content.service';
import { PublicHomeComponent } from './public-home';

const setup = async (api: Partial<StaticContentService>) => {
  await TestBed.configureTestingModule({
    imports: [PublicHomeComponent],
    providers: [
      provideRouter([]),
      provideZonelessChangeDetection(),
      { provide: StaticContentService, useValue: api },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(PublicHomeComponent);
  fixture.detectChanges();
  return fixture;
};

describe('PublicHomeComponent', () => {
  it('fonctionne sans connexion et liste les prochaines séquences', async () => {
    const fixture = await setup({
      getPublicProgramDay: () =>
        of({
          date: '2027-10-31',
          updatedAt: '2026-11-11',
          sequences: [
            { title: 'Messe', startTime: '14:30', endTime: '16:00', location: 'Grande salle' },
            { title: 'Accueil', startTime: '12:00', endTime: '13:30', location: 'Grande salle' },
          ],
        }),
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Mode public');
    expect(el.textContent).toContain('Aucun compte nécessaire');
    const times = [...el.querySelectorAll('.next-item .time')].map((n) =>
      n.textContent?.trim(),
    );
    expect(times).toEqual(['12:00', '14:30']);
  });

  it('tolère un contenu indisponible', async () => {
    const fixture = await setup({
      getPublicProgramDay: () => throwError(() => new Error('offline')),
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Mode public');
    expect(el.querySelector('.next-list')).toBeNull();
  });
});
