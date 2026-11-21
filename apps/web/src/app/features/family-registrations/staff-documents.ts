import { Component, OnInit, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
interface Piece {
  id: string;
  name: string;
  status: string;
  reason: string;
}
@Component({
  selector: 'app-staff-family-documents',
  imports: [...SHARED_IMPORTS],
  template: `<h3>Pièces administratives</h3>
    <p>Ne consignez ici aucune donnée médicale.</p>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    @for (p of pieces(); track p.id) {
      <article>
        <strong>{{ p.name }}</strong>
        <p>{{ statusLabels[p.status] || p.status }} · {{ p.reason }}</p>
        <button tuiButton appearance="secondary" size="s" (click)="download(p)">Télécharger</button
        ><button tuiButton appearance="secondary" size="s" (click)="review(p, 'ACCEPTED', '')">
          Accepter la pièce</button
        ><tui-textfield
          ><label tuiLabel [for]="'piece-reason-' + p.id">Correction à demander</label
          ><input tuiInput [id]="'piece-reason-' + p.id" #reason /></tui-textfield
        ><button
          tuiButton
          appearance="secondary"
          size="s"
          (click)="review(p, 'CORRECTION', reason.value)"
        >
          Demander une nouvelle pièce
        </button>
      </article>
    } @empty {
      <p>Aucune pièce déposée pour ce jeune.</p>
    }`,
  styles: [
    `
      article {
        padding: 1rem;
        border: 1px solid var(--tui-border-normal);
        margin: 1rem 0;
        border-radius: 10px;
      }
      button {
        margin: 0.4rem;
      }
      tui-textfield {
        margin: 1rem 0;
      }
    `,
  ],
})
export class StaffFamilyDocuments implements OnInit {
  readonly family = input.required<string>();
  readonly youth = input.required<string>();
  private http = inject(HttpClient);
  protected statusLabels: Record<string, string> = {
    RECEIVED: 'Reçue, à vérifier',
    ACCEPTED: 'Acceptée',
    CORRECTION: 'Correction demandée',
  };
  protected pieces = signal<Piece[]>([]);
  protected error = signal('');
  private base() {
    return '/api/family-registrations/' + this.family() + '/youths/' + this.youth() + '/documents';
  }
  async ngOnInit() {
    try {
      this.pieces.set(await firstValueFrom(this.http.get<Piece[]>(this.base())));
    } catch {
      this.error.set('Pièces indisponibles');
    }
  }
  protected async review(p: Piece, status: string, reason: string) {
    try {
      this.pieces.set(
        await firstValueFrom(
          this.http.patch<Piece[]>(this.base() + '/' + p.id, { status, reason }),
        ),
      );
    } catch {
      this.error.set('Statut non enregistré. Un motif est requis pour une correction.');
    }
  }
  protected async download(p: Piece) {
    try {
      const blob = await firstValueFrom(
          this.http.get(this.base() + '/' + p.id, { responseType: 'blob' }),
        ),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = p.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.error.set('Téléchargement indisponible');
    }
  }
}
