import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { RegistrationApiService } from './registration-api.service';
import type {
  PublicParticipantRegistrationPayload,
  PublicVolunteerApplicationPayload,
} from '@mej-allegria/shared';

describe('RegistrationApiService', () => {
  let service: RegistrationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RegistrationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts participant registrations to /api/public/participant-registrations', () => {
    const payload: PublicParticipantRegistrationPayload = {
      participants: [
        {
          firstName: 'Alice',
          lastName: 'Martin',
          dateOfBirth: '2012-05-01',
          sex: 'FEMALE',
          mejAgeGroup: 'TA',
          emergencyContactName: 'Bob Martin',
          emergencyContactPhone: '0600000000',
        },
      ],
    };

    let result: unknown;
    service.submitParticipantRegistration(payload).subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/public/participant-registrations');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ createdCount: 1, status: 'PENDING' });

    expect(result).toEqual({ createdCount: 1, status: 'PENDING' });
  });

  it('posts volunteer applications to /api/public/volunteer-applications', () => {
    const payload: PublicVolunteerApplicationPayload = {
      firstName: 'Chloé',
      lastName: 'Durand',
      email: 'chloe@example.com',
      phone: '0600000000',
    };

    let result: unknown;
    service.submitVolunteerApplication(payload).subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/public/volunteer-applications');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ status: 'PENDING' });

    expect(result).toEqual({ status: 'PENDING' });
  });
});
