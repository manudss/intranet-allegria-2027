import { Component, inject, input, signal, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
interface Piece {
  id: string;
  name: string;
  status: string;
  reason: string;
}
@Component({
  selector: 'app-family-documents',
  template: `<section>
    <h3>Pièces administratives de ce jeune</h3>
    <p>
      PDF, PNG ou JPEG, 2 Mo maximum. Ne déposez ici aucun document médical, ordonnance ni
      justificatif de vaccination : leur remise suit le circuit santé confidentiel.
    </p>
    <label [for]="'piece-' + youthId()">Choisir une pièce administrative</label
    ><input
      type="file"
      [id]="'piece-' + youthId()"
      accept="application/pdf,image/png,image/jpeg"
      (change)="upload($event)"
      [disabled]="busy()"
    />
    <p role="status">{{ status() }}</p>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    <ul>
      @for (p of pieces(); track p.id) {
        <li>
          <a [href]="base() + '/' + p.id">{{ p.name }}</a> ·
          {{ p.status === 'RECEIVED' ? 'Reçue, à vérifier' : p.status }}
          @if (p.reason) {
            : {{ p.reason }}
          }
        </li>
      }
    </ul>
  </section>`,
  styles: [
    `
      section {
        margin: 1.5rem 0;
        padding: 1rem;
        border: 1px solid #dcc8b7;
        border-radius: 10px;
      }
      input {
        display: block;
        max-width: 100%;
        margin: 1rem 0;
        min-height: 48px;
      }
      a {
        color: #a42a11;
      }
    `,
  ],
})
export class FamilyDocuments implements OnInit {
  readonly youthId = input.required<string>();
  private http = inject(HttpClient);
  protected pieces = signal<Piece[]>([]);
  protected busy = signal(false);
  protected error = signal('');
  protected status = signal('');
  protected base() {
    return '/api/public/family-space/youths/' + this.youthId() + '/documents';
  }
  async ngOnInit() {
    try {
      this.pieces.set(await firstValueFrom(this.http.get<Piece[]>(this.base())));
    } catch {
      this.error.set('Pièces non chargées. Réessayez avant de quitter.');
    }
  }
  protected async upload(event: Event) {
    const el = event.target as HTMLInputElement,
      file = el.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.error.set('La pièce dépasse 2 Mo.');
      el.value = '';
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.status.set('Vérification de sécurité du fichier…');
    const body = new FormData();
    body.append('file', file);
    try {
      this.pieces.set(await firstValueFrom(this.http.post<Piece[]>(this.base(), body)));
      this.status.set('Pièce reçue pour vérification.');
    } catch (e) {
      this.status.set('Aucune pièce ajoutée.');
      this.error.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Dépôt impossible. Réessayez plus tard.',
      );
    } finally {
      this.busy.set(false);
      el.value = '';
    }
  }
}
