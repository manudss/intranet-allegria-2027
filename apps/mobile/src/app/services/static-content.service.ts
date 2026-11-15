import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

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
 * temps réel). Le fichier statique /content/program-<date>.json ne sert de
 * repli que tant que l'appareil n'a jamais vu d'instantané API pour ce jour :
 * dès qu'un instantané (même vide, après une dépublication) a été reçu, il
 * prime et l'ancien fichier n'est plus jamais relu — pas de réapparition
 * d'un grand temps retiré. Infos et contacts restent des assets statiques.
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
      map((day) => {
        this.markSnapshotSeen(date);
        return day;
      }),
      catchError(() => {
        if (this.hasSeenSnapshot(date)) {
          // Un instantané API a déjà été vu pour ce jour : l'ancien fichier
          // statique ne doit plus jamais réapparaître.
          return of({ date, updatedAt: null, sequences: [] });
        }
        return this.http.get<PublicProgramDay>(`/content/program-${date}.json`);
      }),
    );
  }

  private snapshotKey(date: string): string {
    return `allegria_public_snapshot_seen_${date}`;
  }

  private hasSeenSnapshot(date: string): boolean {
    try {
      return localStorage.getItem(this.snapshotKey(date)) === '1';
    } catch {
      return false;
    }
  }

  private markSnapshotSeen(date: string): void {
    try {
      localStorage.setItem(this.snapshotKey(date), '1');
    } catch {
      // stockage indisponible : le repli restera possible, comportement dégradé acceptable
    }
  }
}
