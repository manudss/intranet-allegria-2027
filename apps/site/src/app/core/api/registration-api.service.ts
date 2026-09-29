import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  PublicHostFamilyRegistrationPayload,
  PublicHostFamilyRegistrationResult,
  PublicParticipantRegistrationPayload,
  PublicParticipantRegistrationResult,
  PublicVolunteerApplicationPayload,
  PublicVolunteerApplicationResult,
} from '@mej-allegria/shared';

/**
 * Appelle les endpoints publics d'inscription de l'API (voir
 * apps/api/src/app/core/public-registrations/). Ces routes ne nécessitent
 * aucune authentification mais sont limitées en fréquence (rate-limiting)
 * et valident strictement les données côté serveur.
 *
 * Les demandes sont en attente de validation (familles : `DRAFT`), revues et
 * validées manuellement par un membre de l'équipe d'organisation avant tout
 * traitement (aucune confirmation automatique par e-mail n'est envoyée).
 */
@Injectable({ providedIn: 'root' })
export class RegistrationApiService {
  private readonly http = inject(HttpClient);

  submitHostFamilyRegistration(
    payload: PublicHostFamilyRegistrationPayload,
  ): Observable<PublicHostFamilyRegistrationResult> {
    return this.http.post<PublicHostFamilyRegistrationResult>(
      '/api/public/host-family-registrations',
      payload,
    );
  }

  /** Inscription des jeunes au rassemblement. */
  submitParticipantRegistration(
    payload: PublicParticipantRegistrationPayload,
  ): Observable<PublicParticipantRegistrationResult> {
    return this.http.post<PublicParticipantRegistrationResult>(
      '/api/public/participant-registrations',
      payload,
    );
  }

  submitVolunteerApplication(
    payload: PublicVolunteerApplicationPayload,
  ): Observable<PublicVolunteerApplicationResult> {
    return this.http.post<PublicVolunteerApplicationResult>(
      '/api/public/volunteer-applications',
      payload,
    );
  }
}
