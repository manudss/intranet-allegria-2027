import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
export interface GroupSource {
  label?: string;
  teamId?: number | null;
  personType?: string | null;
  participantId?: number | null;
  volunteerId?: number | null;
}
export interface ManagedGroup {
  id: number;
  name: string;
  version: number;
  archivedAt?: string | null;
  archived_at?: string | null;
  sources: GroupSource[];
}
export interface ManagedPassage {
  id: number;
  group_id: number;
  point_id: number;
  scan_type_id: number;
  service_key: string | null;
  label: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  version: number;
  archived_at: string | null;
  pointName: string;
  groupName: string;
}
export interface GroupMember {
  personKey: string;
  participantId: number | null;
  volunteerId: number | null;
  firstName: string;
  lastName: string | null;
  type: string;
}
export interface Page<T> {
  items: T[];
  total: number;
}
export interface SaveGroup {
  name: string;
  sources: GroupSource[];
  version?: number;
  archived: boolean;
}
export interface SavePassage {
  groupId: number;
  pointId: number;
  scanTypeId: number;
  serviceKey?: string;
  label: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  version?: number;
  archived: boolean;
}
@Injectable({ providedIn: 'root' })
export class ExpectedGroupsApi {
  private http = inject(HttpClient);
  private base = '/api/access-control/expected';
  groups(q: string, offset: number) {
    return this.http.get<Page<ManagedGroup>>(this.base + '/groups', {
      params: new HttpParams().set('q', q).set('limit', 50).set('offset', offset),
    });
  }
  group(id: number) {
    return this.http.get<ManagedGroup>(this.base + '/groups/' + id);
  }
  save(id: number | null, dto: SaveGroup) {
    return id
      ? this.http.put<ManagedGroup>(this.base + '/groups/' + id, dto)
      : this.http.post<ManagedGroup>(this.base + '/groups', dto);
  }
  members(id: number, offset: number) {
    return this.http.get<Page<GroupMember>>(this.base + '/groups/' + id + '/members', {
      params: new HttpParams().set('limit', 50).set('offset', offset),
    });
  }
  passages(id: number, offset: number) {
    return this.http.get<Page<ManagedPassage>>(this.base + '/passages', {
      params: new HttpParams().set('groupId', id).set('limit', 50).set('offset', offset),
    });
  }
  savePassage(id: number | null, dto: SavePassage) {
    return id
      ? this.http.put<ManagedPassage>(this.base + '/passages/' + id, dto)
      : this.http.post<ManagedPassage>(this.base + '/passages', dto);
  }
  people(q: string, offset: number) {
    return this.http.get<Page<GroupMember>>('/api/access-control/reporting/people', {
      params: new HttpParams().set('q', q).set('limit', 50).set('offset', offset),
    });
  }
}
