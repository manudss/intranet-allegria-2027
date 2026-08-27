import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { VolunteerShiftStatus } from '../models/models';
import { VolunteerMissionsApiService } from '../services/api.services';
import { JourJ } from './jour-j';

describe('JourJ', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JourJ],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: VolunteerMissionsApiService,
          useValue: {
            getDayView: () =>
              of([
                {
                  id: 1,
                  missionId: 2,
                  status: VolunteerShiftStatus.TODO,
                  startAt: '2027-07-24T08:00:00.000Z',
                  endAt: '2027-07-24T10:00:00.000Z',
                  location: 'Porte Nord',
                  capacity: 6,
                  isOptional: false,
                  notes: null,
                  createdAt: '2027-07-24T07:00:00.000Z',
                  updatedAt: '2027-07-24T07:00:00.000Z',
                  mission: {
                    id: 2,
                    title: 'Accueil bus',
                    location: 'Porte Nord',
                  },
                },
              ]),
            changeShiftStatus: () => of({}),
          },
        },
        {
          provide: AuthService,
          useValue: {
            hasAnyRole: () => true,
          },
        },
      ],
    }).compileComponents();
  });

  it('affiche les shifts du jour', () => {
    const fixture = TestBed.createComponent(JourJ);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Tableau de bord Jour J');
    expect(element.textContent).toContain('Accueil bus');
  });
});

