import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { HEALTH_FORM_PAGES } from '@mej-allegria/shared';
import type { YouthIdentity, FamilyContact, StructuredHealth } from '@mej-allegria/shared';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
interface HealthRow {
  familyId: string;
  youthId: string;
  name: string;
  state: string;
  attested: boolean;
  updatedAt: string;
}
@Component({
  selector: 'app-family-health-staff',
  imports: [...SHARED_IMPORTS],
  template: `<app-page-layout
    title="Dossiers sanitaires"
    description="Accès réservé à l'équipe santé habilitée. Version transmise par la famille. Toute ouverture est journalisée."
    ><p>
      Ouvrez seulement les dossiers nécessaires à votre mission. Ne recopiez aucune donnée médicale
      dans les vues administratives, notifications ou restauration.
    </p>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    @if (detail()) {
      <button tuiButton appearance="secondary" (click)="close()">Fermer le dossier</button>
      <h2>{{ detail()!.identity.firstName }} {{ detail()!.identity.lastName }}</h2>
      <p>
        Responsable : {{ detail()!.contact.name }} · {{ detail()!.contact.phone }}. Urgence :
        {{ detail()!.contact.emergencyName }} · {{ detail()!.contact.emergencyPhone }}
      </p>
      <button tuiButton (click)="download()">Télécharger la fiche complète</button>
      @for (p of pages; track p.title) {
        <section>
          <h3>{{ p.title }}</h3>
          <dl>
            @for (f of p.fields; track f[0]) {
              <dt>{{ f[1] }}</dt>
              <dd>{{ detail()!.health.answers[f[0]] || 'Non renseigné' }}</dd>
            }
          </dl>
        </section>
      }
    } @else {
      <div class="grid">
        @for (row of rows(); track row.youthId) {
          <article>
            <h2>{{ row.name }}</h2>
            <p>{{ row.state }} · {{ row.attested ? 'Fiche attestée' : 'Attestation à obtenir' }}</p>
            <button tuiButton appearance="secondary" (click)="open(row)">
              Ouvrir ce dossier sanitaire
            </button>
          </article>
        } @empty {
          <p>Aucun dossier sanitaire transmis à afficher. La collecte peut être non activée.</p>
        }
      </div>
    }
  </app-page-layout>`,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
        gap: 1rem;
      }
      article,
      section {
        padding: 1rem;
        border: 1px solid var(--tui-border-normal);
        border-radius: 12px;
        margin: 1rem 0;
      }
      dt {
        font-weight: 700;
      }
      dd {
        margin: 0.4rem 0 1rem;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class FamilyHealthStaffPage implements OnInit {
  private http = inject(HttpClient);
  protected pages = HEALTH_FORM_PAGES;
  protected rows = signal<HealthRow[]>([]);
  protected detail = signal<{
    identity: YouthIdentity;
    contact: FamilyContact;
    health: StructuredHealth;
  } | null>(null);
  private current: HealthRow | null = null;
  protected error = signal('');
  async ngOnInit() {
    try {
      this.rows.set(await firstValueFrom(this.http.get<HealthRow[]>('/api/family-health')));
    } catch {
      this.error.set('Accès santé indisponible. Habilitation et activation du circuit requises.');
    }
  }
  protected close() {
    this.detail.set(null);
    this.current = null;
  }
  protected async open(r: HealthRow) {
    this.detail.set(null);
    this.current = r;
    try {
      this.detail.set(
        await firstValueFrom(
          this.http.get<{
            identity: YouthIdentity;
            contact: FamilyContact;
            health: StructuredHealth;
          }>('/api/family-health/' + r.familyId + '/youths/' + r.youthId),
        ),
      );
    } catch {
      this.error.set('Dossier non accessible.');
    }
  }
  protected async download() {
    if (!this.current) return;
    try {
      const r = this.current,
        blob = await firstValueFrom(
          this.http.get('/api/family-health/' + r.familyId + '/youths/' + r.youthId + '/pdf', {
            responseType: 'blob',
          }),
        );
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = 'fiche-sanitaire.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.error.set('Téléchargement indisponible.');
    }
  }
}
