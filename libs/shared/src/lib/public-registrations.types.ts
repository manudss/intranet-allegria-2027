/**
 * Contrats partagés pour les formulaires publics d'inscription (site) et
 * les endpoints publics d'inscription de l'API (apps/api).
 *
 * Ces interfaces décrivent uniquement la forme des données échangées sur le
 * réseau (payloads HTTP) ; elles ne portent aucune logique de validation.
 * Les décorateurs class-validator vivent côté apps/api, dans les DTOs qui
 * implémentent ces interfaces.
 */

/** Miroir de apps/api ParticipantSex. */
export type PublicParticipantSex = 'FEMALE' | 'MALE' | 'OTHER' | 'UNDISCLOSED';

/** Miroir de apps/api MejAgeGroup (TA = Tranche Témoins Aujourd'hui, ES = tranche Equipe Espérance). */
export type PublicMejAgeGroup = 'TA' | 'ES';

/** Un jeune à inscrire, saisi soit directement, soit au sein d'une inscription famille. */
export interface PublicParticipantEntry {
  firstName: string;
  lastName: string;
  /** Format ISO `YYYY-MM-DD`. */
  dateOfBirth: string;
  sex: PublicParticipantSex;
  mejAgeGroup: PublicMejAgeGroup;
  diocese?: string;
  city?: string;
  /** Utilisé seulement si le jeune s'inscrit seul (pas de contact parent partagé). */
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

/** Coordonnées d'un parent/représentant légal, communes à tous les enfants d'une même inscription famille. */
export interface PublicParentContact {
  name: string;
  phone: string;
  email?: string;
}

/**
 * Corps de requête pour `POST /api/public/participant-registrations`.
 * Utilisé à la fois par `/inscription/jeunes` (1 seul élément dans `participants`,
 * sans `parentContact`) et `/inscription/familles` (N éléments + `parentContact`).
 */
export interface PublicParticipantRegistrationPayload {
  parentContact?: PublicParentContact;
  participants: PublicParticipantEntry[];
  /** Champ honeypot anti-bot : doit rester vide, jamais affiché à un humain. */
  honeypot?: string;
}

/** Réponse de succès de l'inscription participants/famille. */
export interface PublicParticipantRegistrationResult {
  createdCount: number;
  status: 'PENDING';
}

/** Corps de requête pour `POST /api/public/volunteer-applications`. */
export interface PublicVolunteerApplicationPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Identifiants des missions d'intérêt (voir volunteer-missions.content.ts côté site). */
  missionsOfInterest?: string[];
  availability?: string;
  motivation?: string;
  /** Champ honeypot anti-bot : doit rester vide, jamais affiché à un humain. */
  honeypot?: string;
}

/** Réponse de succès de la candidature bénévole. */
export interface PublicVolunteerApplicationResult {
  status: 'PENDING';
}
