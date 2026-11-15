import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';

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
  /** null tant que la liste n'a jamais été publiée depuis l'agenda */
  updatedAt: string | null;
  sequences: PublicSequence[];
}

/**
 * Contenu public/parteil.
 * Le programme des grands temps vient de l'instantané régénéré par le bouton
 * « Mettre à jour la liste publique » (route publique de l'API, jamais de
 * temps réel) ; le fichier statique /content/program-<date>.json sert de
 * repli (API injoignable). Infos et contacts restent des assets statiques.
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
    return this.http.get<PublicProgramDay>(`/api/public/program/${date}`).pipe(
      catchError(() => this.http.get<PublicProgramDay>(`/content/program-${date}.json`)),
    );
  }
}
