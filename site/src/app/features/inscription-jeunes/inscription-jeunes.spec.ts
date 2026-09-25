import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { InscriptionJeunes } from './inscription-jeunes';

function setInputValue(el: HTMLInputElement | HTMLSelectElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input'));
  el.dispatchEvent(new Event('change'));
}

function setChecked(el: HTMLInputElement, checked: boolean): void {
  el.checked = checked;
  el.dispatchEvent(new Event('change'));
}

describe('InscriptionJeunes', () => {
  let httpMock: HttpTestingController;

  async function createFixture() {
    await TestBed.configureTestingModule({
      imports: [InscriptionJeunes],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(InscriptionJeunes);
    fixture.detectChanges();
    httpMock = TestBed.inject(HttpTestingController);
    return fixture;
  }

  function fillValidForm(root: HTMLElement) {
    setInputValue(root.querySelector('#jeune-firstName') as HTMLInputElement, 'Alice');
    setInputValue(root.querySelector('#jeune-lastName') as HTMLInputElement, 'Martin');
    setInputValue(root.querySelector('#jeune-dateOfBirth') as HTMLInputElement, '2012-05-01');
    setInputValue(root.querySelector('#jeune-sex') as HTMLSelectElement, 'FEMALE');
    setInputValue(root.querySelector('#jeune-ageGroup') as HTMLSelectElement, 'TA');
    setInputValue(root.querySelector('#jeune-emergencyName') as HTMLInputElement, 'Bob Martin');
    setInputValue(root.querySelector('#jeune-emergencyPhone') as HTMLInputElement, '0600000000');
    setChecked(root.querySelector('#jeune-consent') as HTMLInputElement, true);
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('renders the registration form', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('form')).toBeTruthy();
    expect(root.querySelector('#jeune-consent')).toBeTruthy();
  });

  it('does not call the API when required fields are empty', async () => {
    const fixture = await createFixture();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    httpMock.expectNone('/api/public/participant-registrations');
  });

  it('submits a single-participant payload when the form is valid', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    fillValidForm(root);
    fixture.detectChanges();

    const form = root.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    const req = httpMock.expectOne('/api/public/participant-registrations');
    expect(req.request.body.participants.length).toBe(1);
    expect(req.request.body.participants[0].firstName).toBe('Alice');
    expect(req.request.body.parentContact).toBeUndefined();
    req.flush({ createdCount: 1, status: 'PENDING' });

    fixture.detectChanges();
    expect(root.textContent).toContain('Merci');
  });

  it('shows an error message when the API call fails', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    fillValidForm(root);
    fixture.detectChanges();

    const form = root.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    const req = httpMock.expectOne('/api/public/participant-registrations');
    req.flush('error', { status: 500, statusText: 'Server error' });

    fixture.detectChanges();
    expect(root.querySelector('.form-alert--error')).toBeTruthy();
  });
});
