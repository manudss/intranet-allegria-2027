import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export type TransportDirection = 'ALLER' | 'RETOUR';
export type PersonType = 'PARTICIPANT' | 'VOLUNTEER';

export interface DelegationTransport {
  id: number;
  direction: TransportDirection;
  transportMode: 'TRAIN' | 'CAR' | 'VOITURES' | 'AUTRE';
  name: string;
  departureDatetime: string | null;
  arrivalDatetime: string | null;
  meetingPoint: string | null;
  practicalInfo: string | null;
  capacity: number | null;
  notes: string | null;
}

export interface TransportPayload {
  direction: TransportDirection;
  transportMode: string;
  name: string;
  departureDatetime?: string | null;
  arrivalDatetime?: string | null;
  meetingPoint?: string | null;
  practicalInfo?: string | null;
  capacity?: number | null;
  notes?: string | null;
}

export interface PersonLite {
  personType: PersonType;
  id: number;
  firstName: string;
  lastName: string;
  detail: string | null;
  delegationId: number | null;
}

export interface AssignmentEntry {
  assignmentId: number | null;
  person: PersonLite | null;
  transportId: number | null;
  delegationId: number;
}

export interface RepartitionTransport extends DelegationTransport {
  occupancy: number;
  full: boolean;
  persons: AssignmentEntry[];
}

export interface Repartition {
  delegationId: number;
  direction: TransportDirection;
  toAssign: AssignmentEntry[];
  transports: RepartitionTransport[];
  exceptionsReceived: AssignmentEntry[];
  exceptionsOutgoing: AssignmentEntry[];
}

export interface DelegationStats {
  delegationId: number;
  directions: {
    direction: TransportDirection;
    total: number;
    members: number;
    exceptionsReceived: number;
    exceptionsOutgoing: number;
    toPlace: number;
  }[];
}

export interface PersonNote {
  id: number;
  personType: PersonType;
  personId: number;
  authorName: string;
  authorRole: string | null;
  parent: PersonNote | null;
  body: string;
  createdAt: string;
}

export interface NoteFeedRow {
  person: PersonLite | null;
  delegationId: number;
  notesCount: number;
  unansweredCount: number;
  lastNote: {
    id: number;
    body: string;
    authorName: string;
    authorRole: string | null;
    createdAt: string;
  } | null;
}

export interface PersonJourney {
  direction: TransportDirection;
  status: 'PLACED' | 'TO_ASSIGN';
  assignmentId: number;
  delegation: { id: number; name: string };
  exception: boolean;
  transport: {
    id: number;
    name: string;
    mode: string;
    departureDatetime: string | null;
    arrivalDatetime: string | null;
    meetingPoint: string | null;
  } | null;
}

export interface PersonJourneys {
  personType: PersonType;
  personId: number;
  journeys: PersonJourney[];
}

export interface DelegationDirectionSummary {
  total: number;
  toPlace: number;
  placed: number;
}

/** Synthèse d'une délégation pour la page cartes (lot 3 de la refonte). */
export interface DelegationSummary {
  id: number;
  name: string;
  diocese: string | null;
  zone: 'metropole' | 'outre-mer' | 'luxembourg' | 'belgique' | 'institutionnel' | null;
  country: 'FR' | 'LU' | 'BE' | null;
  jeunes: number;
  animateurs: number;
  benevoles: number;
  total: number;
  aller: DelegationDirectionSummary;
  retour: DelegationDirectionSummary;
  toPlace: number;
  exceptionsReceived: number;
  exceptionsOutgoing: number;
  responsables: string[];
}

@Injectable({ providedIn: 'root' })
export class DelegationsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/delegations';

  listSummaries() {
    return this.http.get<DelegationSummary[]>(this.base);
  }

  journeysForFiche(participantId: number) {
    return this.http.get<PersonJourneys>(`${this.base}/fiches/${participantId}/journeys`);
  }

  listTransports(delegationId: number, direction: TransportDirection) {
    return this.http.get<DelegationTransport[]>(`${this.base}/${delegationId}/transports`, {
      params: new HttpParams().set('direction', direction),
    });
  }
  createTransport(delegationId: number, payload: TransportPayload) {
    return this.http.post<DelegationTransport>(`${this.base}/${delegationId}/transports`, payload);
  }
  updateTransport(transportId: number, payload: Partial<TransportPayload>) {
    return this.http.patch<DelegationTransport>(`${this.base}/transports/${transportId}`, payload);
  }
  removeTransport(transportId: number) {
    return this.http.delete(`${this.base}/transports/${transportId}`);
  }
  persons(delegationId: number) {
    return this.http.get<PersonLite[]>(`${this.base}/${delegationId}/persons`);
  }
  repartition(delegationId: number, direction: TransportDirection) {
    return this.http.get<Repartition>(`${this.base}/${delegationId}/repartition`, {
      params: new HttpParams().set('direction', direction),
    });
  }
  stats(delegationId: number) {
    return this.http.get<DelegationStats>(`${this.base}/${delegationId}/stats`);
  }
  assign(transportId: number, personType: PersonType, personId: number) {
    return this.http.put(`${this.base}/transports/${transportId}/assignments`, {
      personType,
      personId,
    });
  }
  unassign(assignmentId: number) {
    return this.http.delete(`${this.base}/assignments/${assignmentId}`);
  }
  createException(
    delegationId: number,
    payload: {
      personType: PersonType;
      personId: number;
      direction: TransportDirection;
      toDelegationId: number;
    },
  ) {
    return this.http.post(`${this.base}/${delegationId}/exceptions`, payload);
  }

  notesFeed(filter: 'WITH_NOTES' | 'UNANSWERED' | 'ALL', q?: string) {
    let params = new HttpParams().set('filter', filter);
    if (q) params = params.set('q', q);
    return this.http.get<NoteFeedRow[]>('/api/person-notes', { params });
  }
  personNotes(personType: PersonType, personId: number) {
    return this.http.get<PersonNote[]>(`/api/person-notes/person/${personType}/${personId}`);
  }
  createNote(personType: PersonType, personId: number, body: string) {
    return this.http.post<PersonNote>(`/api/person-notes/person/${personType}/${personId}`, {
      body,
    });
  }
  replyToNote(noteId: number, body: string) {
    return this.http.post<PersonNote>(`/api/person-notes/${noteId}/replies`, { body });
  }
}
