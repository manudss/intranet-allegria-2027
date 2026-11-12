import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { StaticContentService } from '../../services/static-content.service';
import { InfosComponent } from './infos';

const setup = async (api: Partial<StaticContentService>) => {
  await TestBed.configureTestingModule({
    imports: [InfosComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: StaticContentService, useValue: api },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(InfosComponent);
  fixture.detectChanges();
  return fixture;
};

describe('InfosComponent', () => {
  it('affiche sections et contacts', async () => {
    const fixture = await setup({
      getInfos: () =>
        of({
          updatedAt: '2026-11-11',
          sections: [{ title: 'Sécurité', items: ['Point de rassemblement : chapelle'] }],
        }),
      getContacts: () =>
        of({ updatedAt: '2026-11-11', contacts: [{ label: 'Coordination', detail: 'Canal 1' }] }),
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sécurité');
    expect(el.textContent).toContain('Point de rassemblement : chapelle');
    expect(el.textContent).toContain('Coordination');
  });

  it('affiche un message hors-ligne', async () => {
    const fixture = await setup({
      getInfos: () => throwError(() => new Error('offline')),
      getContacts: () => throwError(() => new Error('offline')),
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Infos indisponibles',
    );
  });
});
