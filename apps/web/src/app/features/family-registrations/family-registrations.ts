import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { FamilyRegistrationsApiService } from '../../services/api.services';
import { AuthService } from '../../core/auth.service';
import type { FamilySpace, FamilyRules } from '../../models/models';
@Component({
  selector: 'app-family-registrations',
  imports: [...SHARED_IMPORTS, FormField],
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
              <span tuiBadge>{{ row.youth.state }}</span> · {{ row.youth.identity.dioceseId }}
            </p>
            <p>{{ row.family.contact.name }} · {{ row.family.email }}</p>
            <p>
              {{ row.youth.signatures.length }} attestation(s) · Simulation :
              {{ row.youth.simulation }}
            </p>
            @if (row.youth.correction) {
              <p>Retour : {{ row.youth.correction }}</p>
            }
            <details>
              <summary>Voir le dossier administratif</summary>
              <dl>
                <dt>Naissance</dt>
                <dd>{{ row.youth.identity.dateOfBirth }}</dd>
                <dt>Responsable</dt>
                <dd>{{ row.family.contact.name }} · {{ row.family.contact.phone }}</dd>
                <dt>Contact d'urgence</dt>
                <dd>
                  {{ row.family.contact.emergencyName }} · {{ row.family.contact.emergencyPhone }}
                </dd>
                <dt>Participation</dt>
                <dd>{{ row.youth.logistics.presence }}</dd>
                <dt>Transport et hébergement</dt>
                <dd>
                  {{ row.youth.logistics.transport }} · {{ row.youth.logistics.accommodation }}
                </dd>
              </dl>
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
              id="review-reason"
              [formField]="$any(reviewForm.reason)"
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
          <tui-textfield
            ><label tuiLabel for="rules-json">Règles et modèles (JSON)</label
            ><textarea
              tuiTextarea
              id="rules-json"
              [value]="ruleText()"
              (input)="ruleText.set($any($event.target).value)"
            ></textarea></tui-textfield
          ><button tuiButton (click)="configure()">Enregistrer les règles et versions</button>
        </details>
      }
    </app-page-layout>
  `,
  styles: [
    `
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
  private api = inject(FamilyRegistrationsApiService);
  protected auth = inject(AuthService);
  protected rows = signal<FamilySpace[]>([]);
  protected query = signal('');
  protected error = signal('');
  protected ruleText = signal('');
  protected reviewTarget = signal<{ family: FamilySpace; youth: string } | null>(null);
  protected reviewModel = signal({ reason: '' });
  protected reviewForm = form(this.reviewModel);
  protected filtered = computed(() =>
    this.rows()
      .flatMap((family) => family.youths.map((youth) => ({ family, youth })))
      .filter((r) =>
        JSON.stringify([r.youth.identity, r.family.email, r.family.contact.name, r.youth.state])
          .toLowerCase()
          .includes(this.query().toLowerCase()),
      ),
  );
  async ngOnInit() {
    await this.load();
    if (this.auth.hasRole('ADMIN'))
      try {
        this.ruleText.set(JSON.stringify(await firstValueFrom(this.api.rules()), null, 2));
      } catch {
        this.error.set('Lecture des règles impossible.');
      }
  }
  protected async load() {
    try {
      this.rows.set(await firstValueFrom(this.api.list()));
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
  protected async configure() {
    try {
      const rules = JSON.parse(this.ruleText()) as FamilyRules;
      this.ruleText.set(JSON.stringify(await firstValueFrom(this.api.configure(rules)), null, 2));
      this.error.set('');
    } catch {
      this.error.set('Règles refusées. Vérifiez le format, les versions et la date de référence.');
    }
  }
}
