import { ActivatedRoute, RouterLink } from '@angular/router';
import { FamilyAdministrativeDetail } from './administrative-detail';
import { FamilyRulesEditor } from './family-rules-editor';
import { StaffFamilyDocuments } from './staff-documents';
import { DIOCESES } from '@mej-allegria/shared';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { FamilyRegistrationsApiService } from '../../services/api.services';
import { AuthService } from '../../core/auth.service';
import type { FamilySpace } from '../../models/models';
@Component({
  selector: 'app-family-registrations',
  imports: [
    ...SHARED_IMPORTS,
    FormField,
    StaffFamilyDocuments,
    FamilyRulesEditor,
    FamilyAdministrativeDetail,
    RouterLink,
  ],
  template: `
    <app-page-layout
      title="Inscriptions des familles"
      description="Dossiers par jeune, suivi et corrections. Aucune donnée de santé dans cette vue."
    >
      <button actions tuiButton (click)="load()">Actualiser</button>
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
      <tui-textfield
        ><label tuiLabel for="family-search">Rechercher un jeune ou une famille</label
        ><input
          tuiInput
          id="family-search"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
      /></tui-textfield>
      <p>
        {{ filtered().length }} dossier(s) affiché(s). La simulation de paiement ne vaut jamais
        encaissement ni confirmation.
      </p>
      <div class="grid">
        @for (row of filtered(); track row.youth.id) {
          <article class="dossier">
            <h2>{{ row.youth.identity.firstName }} {{ row.youth.identity.lastName }}</h2>
            <p>
              <span tuiBadge>{{ stateLabels[row.youth.state] || row.youth.state }}</span> ·
              {{ dioceseName(row.youth.identity.dioceseId, row.youth.identity.otherDiocese) }}
            </p>
            <p>{{ row.family.contact.name }} · {{ row.family.email }}</p>
            <p>
              {{ activeAttestations(row.youth) }} attestation(s) active(s) · Simulation :
              {{ simulationLabels[row.youth.simulation] || row.youth.simulation }}
            </p>
            @if (row.youth.correction) {
              <p>Retour : {{ row.youth.correction }}</p>
            }
            <details
              [open]="openDossier() === row.youth.id"
              (toggle)="openDossier.set($any($event.target).open ? row.youth.id : null)"
            >
              <summary>Voir le dossier administratif</summary>
              <app-family-administrative-detail
                [youth]="row.youth"
                [contact]="row.youth.contactAtSubmission || row.family.contact"
                [email]="row.family.email"
                [contactNotice]="
                  row.youth.contactAtSubmission
                    ? 'Contacts figés lors du dernier envoi. Le contact courant du foyer peut avoir changé.'
                    : 'Contacts actuels du foyer, aucun instantané disponible.'
                "
              />
              @if (row.youth.participantId) {
                <a
                  [routerLink]="['/participants']"
                  [queryParams]="{ participant: row.youth.participantId }"
                  >Ouvrir la fiche Participant</a
                >
              }
              @if (auth.hasRole('HEALTH') && row.youth.participantId) {
                <p>
                  <a
                    [routerLink]="['/dossiers-sanitaires']"
                    [queryParams]="{ participant: row.youth.participantId }"
                    >Ouvrir le dossier sanitaire transmis</a
                  >
                </p>
              }
              @if (openDossier() === row.youth.id) {
                <app-staff-family-documents [family]="row.family.id" [youth]="row.youth.id" />
              }
            </details>
            @if (row.youth.state !== 'DRAFT') {
              <button
                tuiButton
                appearance="secondary"
                size="s"
                (click)="choose(row.family, row.youth.id)"
              >
                Examiner / demander une correction
              </button>
            }
          </article>
        } @empty {
          <p>
            Aucun dossier ne correspond à la recherche. Les familles peuvent aussi être encore en
            brouillon.
          </p>
        }
      </div>
      @if (reviewTarget()) {
        <section class="review">
          <h2>Décision sur ce dossier</h2>
          <p>
            Une demande de correction doit indiquer une action précise, sans diagnostic ni détail
            médical.
          </p>
          <tui-textfield
            ><label tuiLabel for="review-reason">Motif ou précision administrative</label
            ><textarea
              tuiTextarea
              [min]="4"
              id="review-reason"
              [ngModel]="reviewModel().reason"
              (ngModelChange)="reviewModel.set({ reason: $event })"
            ></textarea></tui-textfield
          ><button tuiButton appearance="secondary" (click)="review('CORRECTION')">
            Demander une correction</button
          ><button tuiButton (click)="review('VALIDATED')">Valider le dossier</button
          ><button tuiButton appearance="secondary" (click)="review('CONFIRMED')">
            Confirmer la participation</button
          ><button tuiButton appearance="secondary" (click)="review('REFUSED')">
            Refuser la participation</button
          ><button tuiButton appearance="flat" (click)="reviewTarget.set(null)">
            Fermer sans changement
          </button>
        </section>
      }
      @if (auth.hasRole('ADMIN')) {
        <details>
          <summary>Règles et modèles validés de l'événement</summary>
          <p>
            Configuration explicite avant ouverture. Les modèles doivent être validés par
            l'organisation. Les données de démonstration viennent uniquement des seeds. Le volet
            santé reste verrouillé tant que le circuit et les prérequis de déploiement ne sont pas
            validés.
          </p>
          <app-family-rules-editor />
        </details>
      }
    </app-page-layout>
  `,
  styles: [
    `
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
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
        gap: 1rem;
        margin: 1rem 0;
      }
      .dossier,
      .review {
        padding: 1.2rem;
        border: 1px solid var(--tui-border-normal);
        border-radius: 12px;
      }
      .dossier h2 {
        margin-top: 0;
      }
      .review button {
        margin: 0.5rem 0.5rem 0.5rem 0;
      }
      dl {
        line-height: 1.5;
      }
      dd {
        margin: 0 0 0.5rem;
      }
      details {
        margin: 1rem 0;
      }
      summary {
        cursor: pointer;
        font-weight: 700;
      }
      textarea {
        min-height: 160px;
      }
    `,
  ],
})
export class FamilyRegistrationsPage implements OnInit {
  private route = inject(ActivatedRoute);
  protected activeAttestations(y: FamilySpace['youths'][number]) {
    return y.signatures.filter((a) => !a.withdrawnAt).length;
  }
  protected openDossier = signal<string | null>(null);
  protected stateLabels: Record<string, string> = {
    DRAFT: 'À compléter',
    SUBMITTED: 'En vérification',
    CORRECTION: 'Correction demandée',
    VALIDATED: 'Dossier validé',
    CONFIRMED: 'Participation confirmée',
    REFUSED: 'Participation refusée',
    CANCELLED: 'Annulée',
  };
  protected simulationLabels: Record<string, string> = {
    NOT_TESTED: 'Non testée',
    SUCCESS: 'Réussie, aucun paiement',
    FAILURE: 'Échec simulé',
    CANCELLED: 'Annulation simulée',
  };
  protected dioceseName(id: string, other = '') {
    if (id === 'UNKNOWN') return 'Je ne sais pas encore';
    if (id === 'OTHER') return 'Autre' + (other ? ': ' + other : '');
    return DIOCESES.find((d) => d.id === id)?.name || id;
  }
  private api = inject(FamilyRegistrationsApiService);
  protected auth = inject(AuthService);
  protected rows = signal<FamilySpace[]>([]);
  protected query = signal('');
  protected error = signal('');

  protected reviewTarget = signal<{ family: FamilySpace; youth: string } | null>(null);
  protected reviewModel = signal({ reason: '' });
  protected reviewForm = form(this.reviewModel);
  protected filtered = computed(() =>
    this.rows()
      .flatMap((family) => family.youths.map((youth) => ({ family, youth })))
      .filter(
        (r) =>
          !this.route.snapshot.queryParamMap.get('participant') ||
          String(r.youth.participantId) === this.route.snapshot.queryParamMap.get('participant'),
      )
      .filter((r) =>
        JSON.stringify([r.youth.identity, r.family.email, r.family.contact.name, r.youth.state])
          .toLowerCase()
          .includes(this.query().toLowerCase()),
      ),
  );
  async ngOnInit() {
    await this.load();
  }
  protected async load() {
    try {
      this.rows.set(await firstValueFrom(this.api.list()));
      const participant = this.route.snapshot.queryParamMap.get('participant');
      if (participant)
        this.openDossier.set(
          this.rows()
            .flatMap((f) => f.youths)
            .find((y) => String(y.participantId) === participant)?.id || null,
        );
      this.error.set('');
    } catch {
      this.error.set('Chargement impossible. Aucun dossier affiché ne doit être considéré à jour.');
    }
  }
  protected choose(family: FamilySpace, youth: string) {
    this.reviewTarget.set({ family, youth });
    this.reviewModel.set({ reason: '' });
  }
  protected async review(state: string) {
    const r = this.reviewTarget();
    if (!r) return;
    try {
      await firstValueFrom(
        this.api.review(r.family.id, r.youth, r.family.revision, state, this.reviewModel().reason),
      );
      this.reviewTarget.set(null);
      await this.load();
    } catch {
      this.error.set('Décision non enregistrée. Actualisez et vérifiez le motif.');
    }
  }
}
