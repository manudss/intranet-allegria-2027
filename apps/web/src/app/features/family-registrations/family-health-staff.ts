import { ActivatedRoute, RouterLink } from '@angular/router';
import { FamilyAdministrativeDetail } from './administrative-detail';
import { AuthService } from '../../core/auth.service';
import type { YouthAdministrativeSnapshot } from '@mej-allegria/shared';
import { FOOD_ALLERGEN_LABELS } from '@mej-allegria/shared';
import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  HEALTH_FORM_PAGES,
  HEALTH_MODEL_ITEMS,
  HEALTH_EXTRA_FIELDS,
  HEALTH_WEB_ITEMS,
} from '@mej-allegria/shared';
import type { YouthIdentity, FamilyContact, StructuredHealth } from '@mej-allegria/shared';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
interface HealthRow {
  familyId: string;
  youthId: string;
  participantId?: number;
  name: string;
  state: string;
  attested: boolean;
  updatedAt: string;
}
@Component({
  selector: 'app-family-health-staff',
  imports: [...SHARED_IMPORTS, FamilyAdministrativeDetail, RouterLink],
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
      @if (detail()!.administrative; as administrative) {
        <details open>
          <summary>Dossier administratif transmis</summary>
          <p>{{ detail()!.administrativeNotice }}</p>
          <app-family-administrative-detail
            [youth]="administrative"
            [contact]="detail()!.contact"
            [email]="detail()!.email || ''"
            contactNotice="Contacts de la version transmise, pas ceux d’un brouillon en cours."
          />
          @if (administrative.participantId) {
            <p>
              <a
                [routerLink]="['/participants']"
                [queryParams]="{ participant: administrative.participantId }"
                >Ouvrir la fiche Participant</a
              >
            </p>
          }
          @if (administrative.participantId && auth.hasAnyRole(['ADMIN', 'COORDINATOR'])) {
            <p>
              <a
                [routerLink]="['/inscriptions-familles']"
                [queryParams]="{ participant: administrative.participantId }"
                >Suivi administratif actuel</a
              >
            </p>
          }
        </details>
      } @else {
        <p>{{ detail()!.administrativeNotice }}</p>
      }
      <h3>Attestation sanitaire transmise</h3>
      @if (detail()!.health.signature; as signature) {
        <p>
          {{ signature.name }} ·
          {{ signature.capacity === 'LEGAL' ? 'Représentant légal' : 'Jeune majeur' }} ·
          {{ signature.at | date: 'dd/MM/yyyy HH:mm' : 'Europe/Paris' }}
        </p>
        <p class="digest">Empreinte : {{ signature.digest }}</p>
      }
      <h3>Catégories alimentaires déclarées</h3>
      <ul>
        @for (allergen of detail()!.health.foodAllergens; track allergen) {
          <li>{{ allergenLabels[allergen] || allergen }}</li>
        } @empty {
          <li>Aucune catégorie sélectionnée. Ne permet pas de conclure à l’absence d’allergie.</li>
        }
      </ul>
      <button tuiButton (click)="download()">Télécharger la fiche complète</button>
      <section>
        <h3>Compléments de la fiche web</h3>
        <dl>
          @for (field of extraFields; track field[0]) {
            @if (detail()!.health.answers[field[0]]) {
              <dt>{{ field[1] }}</dt>
              <dd>{{ detail()!.health.answers[field[0]] }}</dd>
            }
          }
        </dl>
        <p>Les compléments sont des déclarations de la famille. Un champ vide ne vaut pas Non.</p>
      </section>
      @for (p of pages; track p.title; let pageIndex = $index) {
        <section>
          <h3>{{ p.title }}</h3>
          <dl>
            @for (f of p.fields; track f[0]) {
              <dt>{{ f[1] }}</dt>
              <dd>{{ detail()!.health.answers[f[0]] || 'Non renseigné' }}</dd>
            }
            @for (item of modelItems; track item.id) {
              @if (item.page === pageIndex) {
                <dt>Choix explicite : {{ item.label }}</dt>
                <dd>{{ presenceLabel(detail()!.health.presence?.[item.id]) }}</dd>
              }
            }
          </dl>
        </section>
      }
    } @else {
      <div class="grid">
        @for (row of rows(); track row.youthId) {
          <article>
            <h2>{{ row.name }}</h2>
            <p>{{ row.state | frLabel }} · {{ row.attested ? 'Fiche attestée' : 'Attestation à obtenir' }}</p>
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
      button[tuiButton] {
        max-width: 100%;
        white-space: normal;
        height: auto;
        min-height: 48px;
        padding-block: 0.8rem;
        text-align: center;
        overflow-wrap: anywhere;
      }
      button[appearance='secondary'] {
        color: #8f1838;
      }
      a {
        color: #8f1838;
        text-decoration: underline;
        text-underline-offset: 0.15em;
      }
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
      .digest {
        overflow-wrap: anywhere;
        font-size: 0.8rem;
      }
      summary {
        cursor: pointer;
        font-weight: 700;
        margin-top: 1rem;
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
  protected auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  protected allergenLabels: Record<string, string> = FOOD_ALLERGEN_LABELS;
  protected modelItems = [...HEALTH_MODEL_ITEMS, ...HEALTH_WEB_ITEMS];
  protected extraFields = HEALTH_EXTRA_FIELDS;
  protected presenceLabel(value?: string) {
    return value === 'YES' ? 'Oui' : value === 'NO' ? 'Non' : 'Non renseigné';
  }
  private http = inject(HttpClient);
  protected pages = HEALTH_FORM_PAGES;
  protected rows = signal<HealthRow[]>([]);
  protected detail = signal<{
    identity: YouthIdentity;
    contact: FamilyContact;
    health: StructuredHealth;
    email?: string;
    administrative?: YouthAdministrativeSnapshot | null;
    administrativeNotice?: string;
  } | null>(null);
  private current: HealthRow | null = null;
  protected error = signal('');
  async ngOnInit() {
    try {
      this.rows.set(await firstValueFrom(this.http.get<HealthRow[]>('/api/family-health')));
      const participant = this.route.snapshot.queryParamMap.get('participant');
      if (participant) {
        const row = this.rows().find((r) => String(r.participantId) === participant);
        if (row) await this.open(row);
        else this.error.set('Aucune fiche sanitaire transmise disponible pour ce participant.');
      }
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
            email?: string;
            administrative?: YouthAdministrativeSnapshot | null;
            administrativeNotice?: string;
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
