import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { InscriptionFamilles } from './inscription-familles';

function setInputValue(el: HTMLInputElement | HTMLSelectElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input'));
  el.dispatchEvent(new Event('change'));
}

function setChecked(el: HTMLInputElement, checked: boolean): void {
  el.checked = checked;
  el.dispatchEvent(new Event('change'));
}

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

  afterEach(() => {
    httpMock.verify();
  });

  it('starts with a single child block', async () => {
    const fixture = await createFixture();
    const blocks = fixture.nativeElement.querySelectorAll('.form-child-block');
    expect(blocks.length).toBe(1);
  });

  it('adds and removes child blocks', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;

    (Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ajouter un autre enfant'),
    ) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.form-child-block').length).toBe(2);

    (root.querySelector('.form-child-block button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.form-child-block').length).toBe(1);
  });

  it('submits a batch payload with the shared parent contact and all children', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;

    setInputValue(root.querySelector('#famille-parentName') as HTMLInputElement, 'Bob Martin');
    setInputValue(root.querySelector('#famille-parentPhone') as HTMLInputElement, '0600000000');

    setInputValue(root.querySelector('#famille-child-0-firstName') as HTMLInputElement, 'Alice');
    setInputValue(root.querySelector('#famille-child-0-lastName') as HTMLInputElement, 'Martin');
    setInputValue(root.querySelector('#famille-child-0-dob') as HTMLInputElement, '2012-05-01');
    setInputValue(root.querySelector('#famille-child-0-sex') as HTMLSelectElement, 'FEMALE');
    setInputValue(root.querySelector('#famille-child-0-ageGroup') as HTMLSelectElement, 'TA');

    (Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ajouter un autre enfant'),
    ) as HTMLButtonElement).click();
    fixture.detectChanges();

    setInputValue(root.querySelector('#famille-child-1-firstName') as HTMLInputElement, 'Léo');
    setInputValue(root.querySelector('#famille-child-1-lastName') as HTMLInputElement, 'Martin');
    setInputValue(root.querySelector('#famille-child-1-dob') as HTMLInputElement, '2014-03-02');
    setInputValue(root.querySelector('#famille-child-1-sex') as HTMLSelectElement, 'MALE');
    setInputValue(root.querySelector('#famille-child-1-ageGroup') as HTMLSelectElement, 'TA');

    setChecked(root.querySelector('#famille-consent') as HTMLInputElement, true);
    fixture.detectChanges();

    const form = root.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    const req = httpMock.expectOne('/api/public/participant-registrations');
    expect(req.request.body.parentContact.name).toBe('Bob Martin');
    expect(req.request.body.participants.length).toBe(2);
    expect(req.request.body.participants[1].firstName).toBe('Léo');
    req.flush({ createdCount: 2, status: 'PENDING' });

    fixture.detectChanges();
    expect(root.textContent).toContain('Merci');
  });

  it('does not call the API when the consent checkbox is unchecked', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;

    setInputValue(root.querySelector('#famille-parentName') as HTMLInputElement, 'Bob Martin');
    setInputValue(root.querySelector('#famille-parentPhone') as HTMLInputElement, '0600000000');
    setInputValue(root.querySelector('#famille-child-0-firstName') as HTMLInputElement, 'Alice');
    setInputValue(root.querySelector('#famille-child-0-lastName') as HTMLInputElement, 'Martin');
    setInputValue(root.querySelector('#famille-child-0-dob') as HTMLInputElement, '2012-05-01');
    setInputValue(root.querySelector('#famille-child-0-sex') as HTMLSelectElement, 'FEMALE');
    setInputValue(root.querySelector('#famille-child-0-ageGroup') as HTMLSelectElement, 'TA');
    fixture.detectChanges();

    const form = root.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    httpMock.expectNone('/api/public/participant-registrations');
  });
});
