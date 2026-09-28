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

/** Un jeune à inscrire au rassemblement. */
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

/** Coordonnées d'un parent/représentant légal, communes aux participants d'un même envoi. */
export interface PublicParentContact {
  name: string;
  phone: string;
  email?: string;
}

/**
 * Corps de requête pour `POST /api/public/participant-registrations`.
 * Utilisé par `/inscription/jeunes`. L'API accepte également plusieurs participants
 * avec un contact parental partagé.
 */
export interface PublicParticipantRegistrationPayload {
  parentContact?: PublicParentContact;
  participants: PublicParticipantEntry[];
  /** Champ honeypot anti-bot : doit rester vide, jamais affiché à un humain. */
  honeypot?: string;
}

/** Réponse de succès de l'inscription des participants. */
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

/** Proposition d'accueil : POST /api/public/host-family-registrations. */
export interface PublicHostFamilyRegistrationPayload {
  familyName: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  /** Capacité totale, jeunes et animateurs compris. */
  maxCapacity: number;
  maxUnder18: number;
  maxAnimators?: number;
  parish?: string;
  constraints?: string[];
  notes?: string;
  honeypot?: string;
}

export interface PublicHostFamilyRegistrationResult {
  status: 'DRAFT';
}
