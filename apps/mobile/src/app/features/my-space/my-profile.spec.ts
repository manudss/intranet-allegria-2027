import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { MySpaceApiService } from '../../services/api.services';
import { Volunteer, VolunteerHosting } from '../../models/models';
import { MyProfileComponent } from './my-profile';

const volunteer: Volunteer = {
  id: 7,
  firstName: 'Ben',
  lastName: 'Martin',
  phone: '+33612345678',
  email: 'ben@example.com',
  team: null,
  isGroupLeader: false,
  notes: null,
  skills: [{ id: 1, skill: 'SOUND' as never }],
  tags: [{ id: 2, value: 'disponible' }],
};

const hosting: VolunteerHosting = {
  id: 5,
  room: 'Dortoir B',
  notes: 'Arrivée possible dès le jeudi soir.',
  startAt: '2027-10-31',
  endAt: '2027-11-03',
  team: { id: 45, name: 'Équipe des Lynx' },
  animators: [{ id: 20, firstName: 'Sarah', lastName: 'Nguyen', role: 'PRIMARY' }],
  youths: [{ firstName: 'Adam' }, { firstName: 'Léa' }, { firstName: 'Zoé' }],
  hostFamilies: [
    {
      id: 34,
      familyName: 'Famille Bernard',
      address: '12 rue des Tilleuls',
      postalCode: '69003',
      city: 'Lyon',
      phone: '+33472727272',
    },
  ],
};

const setup = async (api: Partial<MySpaceApiService>) => {
  await TestBed.configureTestingModule({
    imports: [MyProfileComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: MySpaceApiService, useValue: api },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(MyProfileComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
};

describe('MyProfileComponent', () => {
  it('affiche coordonnées, compétences et hébergement avec l équipe', async () => {
    const fixture = await setup({
      getVolunteer: () => of(volunteer),
      getHosting: () => of(hosting),
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ben Martin');
    expect(el.textContent).toContain('ben@example.com');
    expect(el.textContent).toContain('+33612345678');
    expect(el.textContent).toContain('disponible');
    expect(el.textContent).toContain("Logé avec l'équipe Équipe des Lynx");
    expect(el.textContent).toContain('Sarah Nguyen (animateur référent)');
    expect(el.textContent).toContain('Adam');
    expect(el.textContent).toContain('Zoé');
    expect(el.textContent).toContain('Famille Bernard');
    expect(el.textContent).toContain('12 rue des Tilleuls, 69003 Lyon');
    expect(el.textContent).toContain('Dortoir B');
    expect(el.querySelector('a[href="tel:+33472727272"]')).toBeTruthy();
  });

  it('affiche l état vide quand l hébergement n est pas défini', async () => {
    const fixture = await setup({
      getVolunteer: () => of(volunteer),
      getHosting: () => of(null),
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      "Les informations d'hébergement seront publiées ici",
    );
  });

  it('édite les coordonnées et enregistre via PATCH', async () => {
    let received: unknown = null;
    const fixture = await setup({
      getVolunteer: () => of(volunteer),
      getHosting: () => of(null),
      updateVolunteer: (payload) => {
        received = payload;
        return of({ ...volunteer, phone: '+33699998888' });
      },
    });
    const el = fixture.nativeElement as HTMLElement;
    const editButton = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Modifier mes coordonnées'),
    );
    editButton?.click();
    fixture.detectChanges();

    const phoneInput = el.querySelector<HTMLInputElement>('input[name="phone"]');
    expect(phoneInput).toBeTruthy();
    phoneInput!.value = '+33699998888';
    phoneInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = el.querySelector('form');
    form?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(received).toEqual({ phone: '+33699998888', email: 'ben@example.com' });
    expect(el.textContent).toContain('+33699998888');
  });

  it('signale une erreur d enregistrement', async () => {
    const fixture = await setup({
      getVolunteer: () => of(volunteer),
      getHosting: () => of(null),
      updateVolunteer: () => throwError(() => new Error('400')),
    });
    const el = fixture.nativeElement as HTMLElement;
    const editButton = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Modifier mes coordonnées'),
    );
    editButton?.click();
    fixture.detectChanges();
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Enregistrement impossible');
  });
});
