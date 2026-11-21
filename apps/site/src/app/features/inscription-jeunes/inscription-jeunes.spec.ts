import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InscriptionJeunes } from './inscription-jeunes';
describe('Youth entry', () => {
  it('offers start and resume into the family space instead of a one-shot unresumable form', async () => {
    await TestBed.configureTestingModule({
      imports: [InscriptionJeunes],
      providers: [provideRouter([])],
    }).compileComponents();
    const f = TestBed.createComponent(InscriptionJeunes);
    await f.whenStable();
    const root = f.nativeElement as HTMLElement;
    expect(root.querySelectorAll('a[href="/espace-famille"]').length).toBe(2);
    expect(root.querySelector('form')).toBeNull();
    expect(root.textContent).toContain('sauvegardés');
    expect(root.textContent).not.toContain('capacité d’hébergement');
  });
});
