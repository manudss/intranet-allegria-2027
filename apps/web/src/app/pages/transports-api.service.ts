import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export type GatheringCarTarget = 'HOSTING_GROUP' | 'HOST_FAMILY';
export type GatheringCarPersonKind = 'ADDED' | 'REMOVED';

export interface ServeTarget {
  key: string;
  targetType: GatheringCarTarget;
  id: number;
  name: string;
  detail: string;
  personCount: number;
  assignmentId: number | null;
  carId: number | null;
  carName: string | null;
}

export interface CarStop {
  id: number;
  orderIndex: number;
  label: string;
  time: string | null;
}

export interface CarAssignment {
  id: number;
  targetType: GatheringCarTarget;
  targetId: number;
  name: string;
  personCount: number;
  removedCount: number;
}

export interface CarPerson {
  id: number;
  kind: GatheringCarPersonKind;
  participantId: number;
  firstName: string;
  lastName: string;
}

export interface GatheringCar {
  id: number;
  name: string;
  capacity: number | null;
  serviceDates: string[] | null;
  notes: string | null;
  occupancy: number;
  stops: CarStop[];
  assignments: CarAssignment[];
  persons: CarPerson[];
}

export interface GatheringTransportsBoard {
  targets: ServeTarget[];
  cars: GatheringCar[];
}

export interface CarPayload {
  name: string;
  capacity?: number | null;
  serviceDates?: string[] | null;
  notes?: string | null;
}

export interface StopPayload {
  label: string;
  time?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TransportsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/gathering-transports';

  board() {
    return this.http.get<GatheringTransportsBoard>(`${this.base}/board`);
  }
  createCar(payload: CarPayload) {
    return this.http.post<GatheringCar>(`${this.base}/cars`, payload);
  }
  updateCar(id: number, payload: Partial<CarPayload>) {
    return this.http.patch<GatheringCar>(`${this.base}/cars/${id}`, payload);
  }
  removeCar(id: number) {
    return this.http.delete(`${this.base}/cars/${id}`);
  }
  setStops(id: number, stops: StopPayload[]) {
    return this.http.put<GatheringCar>(`${this.base}/cars/${id}/stops`, { stops });
  }
  assign(id: number, targets: { targetType: GatheringCarTarget; id: number }[]) {
    return this.http.put<GatheringCar>(`${this.base}/cars/${id}/assignments`, { targets });
  }
  unassign(assignmentId: number) {
    return this.http.delete(`${this.base}/assignments/${assignmentId}`);
  }
  addPerson(id: number, participantId: number, kind: GatheringCarPersonKind) {
    return this.http.post<GatheringCar>(`${this.base}/cars/${id}/persons`, { participantId, kind });
  }
  removePerson(personRowId: number) {
    return this.http.delete(`${this.base}/persons/${personRowId}`);
  }
}
