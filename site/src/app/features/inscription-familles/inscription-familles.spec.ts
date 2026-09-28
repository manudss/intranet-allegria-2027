import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { InscriptionFamilles } from './inscription-familles';

const endpoint = '/api/public/host-family-registrations';

describe('InscriptionFamilles', () => {
  let httpMock: HttpTestingController;
  async function createFixture() {
    await TestBed.configureTestingModule({
      imports: [InscriptionFamilles],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(InscriptionFamilles);
    fixture.detectChanges();
    httpMock = TestBed.inject(HttpTestingController);
    return fixture;
  }
  afterEach(() => httpMock?.verify());

  function input(root: HTMLElement, name: string, value: string) {
    const el = root.querySelector(`#famille-${name}`) as HTMLInputElement;
    el.value = value;
    el.dispatchEvent(new Event('input'));
    el.dispatchEvent(new Event('change'));
  }
  function fill(root: HTMLElement, consent = true) {
    for (const [name, value] of Object.entries({
      familyName: '  Famille Bernard  ',
      phone: '0600000000',
      email: 'bernard@example.fr',
      address: '12 rue des Tilleuls',
      postalCode: '42000',
      city: 'Saint-Étienne',
      maxCapacity: '4',
      maxUnder18: '3',
    }))
      input(root, name, value);
    const checkbox = root.querySelector('#famille-consent') as HTMLInputElement;
    if (checkbox.checked !== consent) checkbox.click();
  }
  function send(root: HTMLElement) {
    (root.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
  }

  it('présente uniquement la proposition d’accueil, avec les coordonnées et sans enfant à saisir', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.form-child-block')).toBeNull();
    expect(root.textContent).toContain('Devenir famille d’accueil');
    expect(root.textContent).toContain('réalise les affectations');
    expect(root.querySelector('a[href="/inscription/jeunes"]')).not.toBeNull();
    for (const control of root.querySelectorAll('input:not([tabindex="-1"]), textarea')) {
      expect(root.querySelector(`label[for="${control.id}"]`)).not.toBeNull();
    }
  });

  it('envoie une famille, normalise les contraintes, empêche le double envoi et affiche la confirmation', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    fill(root);
    input(root, 'maxAnimators', '0');
    input(root, 'parish', ' Saint-Pierre ');
    input(root, 'constraints', ' Sans ascenseur \n\n Présence d’un chien ');
    input(root, 'notes', ' Deux chambres ');
    fixture.detectChanges();
    send(root);
    send(root);
    fixture.detectChanges();
    const req = httpMock.expectOne(endpoint);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      familyName: 'Famille Bernard',
      phone: '0600000000',
      email: 'bernard@example.fr',
      address: '12 rue des Tilleuls',
      postalCode: '42000',
      city: 'Saint-Étienne',
      maxCapacity: 4,
      maxUnder18: 3,
      maxAnimators: 0,
      parish: 'Saint-Pierre',
      constraints: ['Sans ascenseur', 'Présence d’un chien'],
      notes: 'Deux chambres',
      honeypot: undefined,
    });
    httpMock.expectNone('/api/public/participant-registrations');
    expect((root.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    req.flush({ status: 'DRAFT' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent).toContain('Votre proposition d’accueil est enregistrée');
    expect(root.querySelector('form')).toBeNull();
    expect(document.activeElement?.textContent).toContain(
      'Votre proposition d’accueil est enregistrée',
    );
  });

  it('omet la capacité facultative lorsqu’elle n’est pas renseignée', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    fill(root);
    fixture.detectChanges();
    send(root);
    const req = httpMock.expectOne(endpoint);
    expect(req.request.body.maxAnimators).toBeUndefined();
    req.flush({ status: 'DRAFT' });
    await fixture.whenStable();
  });

  it('exige le consentement et place le focus sur le résumé des erreurs', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    fill(root, false);
    fixture.detectChanges();
    send(root);
    await fixture.whenStable();
    fixture.detectChanges();
    httpMock.expectNone(endpoint);
    const checkbox = root.querySelector('#famille-consent') as HTMLInputElement;
    expect(checkbox.getAttribute('aria-invalid')).toBe('true');
    expect(checkbox.getAttribute('aria-describedby')).toBe('famille-consent-error');
    expect(document.activeElement?.textContent).toContain('Vérifiez les informations');
    (root.querySelector('.form-error-link') as HTMLButtonElement).click();
    expect(document.activeElement).toBe(checkbox);
  });

  it.each([
    ['phone', ''],
    ['email', 'incorrect'],
    ['familyName', '   '],
    ['maxCapacity', '0'],
    ['maxUnder18', '5'],
    ['maxUnder18', '1.5'],
    ['maxAnimators', '-1'],
  ])('refuse %s = %s et associe l’erreur au champ', async (name, value) => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    fill(root);
    input(root, name, value);
    fixture.detectChanges();
    send(root);
    await fixture.whenStable();
    fixture.detectChanges();
    httpMock.expectNone(endpoint);
    expect(root.querySelector(`#famille-${name}`)?.getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector(`#famille-${name}-error`)?.textContent?.trim()).toBeTruthy();
  });

  it.each([500, 429])(
    'conserve les valeurs après une erreur %s et permet de réessayer',
    async (status) => {
      const fixture = await createFixture();
      const root = fixture.nativeElement as HTMLElement;
      fill(root);
      fixture.detectChanges();
      send(root);
      httpMock.expectOne(endpoint).flush({}, { status, statusText: 'Error' });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(root.textContent).toContain(
        status === 429 ? 'Patientez dix minutes' : 'Vos informations sont conservées',
      );
      expect((root.querySelector('#famille-phone') as HTMLInputElement).value).toBe('0600000000');
      expect((root.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(
        false,
      );
      send(root);
      httpMock.expectOne(endpoint).flush({ status: 'DRAFT' });
      await fixture.whenStable();
    },
  );
});
