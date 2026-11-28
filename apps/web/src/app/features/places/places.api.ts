import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PlaceListItem, PlacePayload } from './places.models';

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
}
