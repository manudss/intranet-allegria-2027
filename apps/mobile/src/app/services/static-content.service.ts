import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface InfosSection {
  title: string;
  items: string[];
}

export interface InfosContent {
  updatedAt: string;
  sections: InfosSection[];
}

export interface ContactEntry {
  label: string;
  detail: string;
}

export interface ContactsContent {
  updatedAt: string;
  contacts: ContactEntry[];
}

export interface PublicSequence {
  title: string;
  startTime: string;
  endTime: string;
  location: string;
}

export interface PublicProgramDay {
  date: string;
  updatedAt: string;
  sequences: PublicSequence[];
}

/**
 * Contenu public/parteil : fichiers JSON statiques (assets), servis par le
 * CDN en production — le serveur API ne répond jamais à ces requêtes.
 */
@Injectable({ providedIn: 'root' })
export class StaticContentService {
  private readonly http = inject(HttpClient);

  getInfos(): Observable<InfosContent> {
    return this.http.get<InfosContent>('/content/infos.json');
  }

  getContacts(): Observable<ContactsContent> {
    return this.http.get<ContactsContent>('/content/contacts.json');
  }

  getPublicProgramDay(date: string): Observable<PublicProgramDay> {
    return this.http.get<PublicProgramDay>(`/content/program-${date}.json`);
  }
}
