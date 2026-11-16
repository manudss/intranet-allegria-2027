import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ProgramApiService } from '../../services/api.services';
import { ProgramSequence, ProgramSequenceStatus, ProgramSequenceTrack } from '../../models/models';
import { dayOf, seq } from './program.fixture';
import { ProgramComponent } from './program';

const setup = async (sequences?: ProgramSequence[]) => {
  await TestBed.configureTestingModule({
    imports: [ProgramComponent],
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: ProgramApiService,
        useValue: {
          getDay: () =>
            of(
              dayOf(
                ...(sequences ?? [
                  seq(1, '12:00'),
                  seq(2, '14:30', { location: 'Chapelle' }),
                  seq(3, '16:00', { status: ProgramSequenceStatus.FROZEN }),
                ]),
              ),
            ),
          getChangeLog: () => of([{ id: 9 }, { id: 10 }]),
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ProgramComponent);
  fixture.detectChanges();
  return fixture;
};

describe('ProgramComponent', () => {
  it('affiche la timeline triée, les lieux et le badge Verrouillé', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;
    const starts = [...el.querySelectorAll('.event .start')].map((n) =>
      n.textContent?.trim(),
    );
    expect(starts).toEqual(['12:00', '14:30', '16:00']);
    expect(el.textContent).toContain('Verrouillé');
    expect(el.textContent).toContain('2 modification(s)');
    expect(el.querySelectorAll('[aria-label="Filtrer par lieu"] .filter-chip').length).toBe(2);
    expect(el.querySelectorAll('[aria-label="Filtrer par piste"] .filter-chip').length).toBe(4);
  });

  it('filtre par lieu au clic sur une puce', async () => {
    const fixture = await setup();
    const chip = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.filter-chip',
      ),
    ].find((c) => c.textContent?.trim() === 'Chapelle');
    expect(chip).toBeDefined();
    chip?.click();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.event').length).toBe(1);
    expect(el.textContent).toContain('Séquence 2');
    expect(el.textContent).not.toContain('Séquence 1');
  });

  it('filtre par piste avec les puces Tous / TA / ES / Communs', async () => {
    const fixture = await setup([
      seq(1, '12:00', { track: ProgramSequenceTrack.TA }),
      seq(2, '14:30', { track: ProgramSequenceTrack.ES }),
      seq(3, '16:00'),
    ]);
    const el = fixture.nativeElement as HTMLElement;
    const group = el.querySelector('[aria-label="Filtrer par piste"]')!;
    expect(group.querySelectorAll('.filter-chip').length).toBe(4);

    const ta = [...group.querySelectorAll<HTMLButtonElement>('.filter-chip')].find(
      (c) => c.textContent?.trim() === 'TA',
    );
    ta?.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.event').length).toBe(1);
    expect(el.textContent).toContain('Séquence 1');
    expect(el.textContent).not.toContain('Séquence 2');

    const common = [...group.querySelectorAll<HTMLButtonElement>('.filter-chip')].find(
      (c) => c.textContent?.trim() === 'Communs',
    );
    common?.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.event').length).toBe(1);
    expect(el.textContent).toContain('Séquence 3');
  });
});
