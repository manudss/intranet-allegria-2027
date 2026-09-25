import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { InscriptionBenevoles } from './inscription-benevoles';

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input'));
  el.dispatchEvent(new Event('change'));
}

function setChecked(el: HTMLInputElement, checked: boolean): void {
  el.checked = checked;
  el.dispatchEvent(new Event('change'));
}

describe('InscriptionBenevoles', () => {
  let httpMock: HttpTestingController;

  async function createFixture() {
    await TestBed.configureTestingModule({
      imports: [InscriptionBenevoles],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(InscriptionBenevoles);
    fixture.detectChanges();
    httpMock = TestBed.inject(HttpTestingController);
    return fixture;
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('renders a checkbox per mission and toggles selection', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const checkboxes = root.querySelectorAll<HTMLInputElement>('.form-checkbox-option input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);

    const first = checkboxes[0];
    expect(first.checked).toBe(false);
    setChecked(first, true);
    fixture.detectChanges();
    expect(first.checked).toBe(true);
  });

  it('does not call the API when required fields are empty', async () => {
    const fixture = await createFixture();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    httpMock.expectNone('/api/public/volunteer-applications');
  });

  it('submits the application payload including selected missions', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;

    setInputValue(root.querySelector('#benevole-firstName') as HTMLInputElement, 'Chloé');
    setInputValue(root.querySelector('#benevole-lastName') as HTMLInputElement, 'Durand');
    setInputValue(root.querySelector('#benevole-email') as HTMLInputElement, 'chloe@example.com');
    setInputValue(root.querySelector('#benevole-phone') as HTMLInputElement, '0600000000');
    setChecked(root.querySelector('.form-checkbox-option input[type="checkbox"]') as HTMLInputElement, true);
    setChecked(root.querySelector('#benevole-consent') as HTMLInputElement, true);
    fixture.detectChanges();

    const form = root.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    const req = httpMock.expectOne('/api/public/volunteer-applications');
    expect(req.request.body.email).toBe('chloe@example.com');
    expect(req.request.body.missionsOfInterest.length).toBe(1);
    req.flush({ status: 'PENDING' });

    fixture.detectChanges();
    expect(root.textContent).toContain('Merci');
  });
});
