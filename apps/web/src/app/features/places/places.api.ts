import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PlaceFiche, PlaceListItem, PlacePayload, PlaceRoom } from './places.models';

@Injectable({ providedIn: 'root' })
export class PlacesApiService {
  private readonly http = inject(HttpClient);
  private readonly path = '/api/places';

  list(filters?: { kind?: string; q?: string }): Observable<PlaceListItem[]> {
    const params: Record<string, string> = {};
    if (filters?.kind) params['kind'] = filters.kind;
    if (filters?.q) params['q'] = filters.q;
    return this.http.get<PlaceListItem[]>(this.path, { params });
  }
  create(payload: PlacePayload): Observable<PlaceListItem> {
    return this.http.post<PlaceListItem>(this.path, payload);
  }
  update(id: number, payload: Partial<PlacePayload>): Observable<PlaceListItem> {
    return this.http.patch<PlaceListItem>(`${this.path}/${id}`, payload);
  }
  fiche(id: number): Observable<PlaceFiche> {
    return this.http.get<PlaceFiche>(`${this.path}/${id}`);
  }
  addRoom(id: number, name: string): Observable<PlaceRoom> {
    return this.http.post<PlaceRoom>(`${this.path}/${id}/rooms`, { name });
  }
  renameRoom(id: number, roomId: number, name: string): Observable<PlaceRoom> {
    return this.http.patch<PlaceRoom>(`${this.path}/${id}/rooms/${roomId}`, { name });
  }
  removeRoom(id: number, roomId: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.path}/${id}/rooms/${roomId}`);
  }
  setTeams(id: number, volunteerTeamIds: number[]): Observable<{ volunteerTeamIds: number[] }> {
    return this.http.put<{ volunteerTeamIds: number[] }>(`${this.path}/${id}/teams`, { volunteerTeamIds });
  }
}
