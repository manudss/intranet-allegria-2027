import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { form, FormField } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import {
  EMPTY_HEALTH,
  HEALTH_FORM_PAGES,
  FOOD_ALLERGENS,
  FOOD_ALLERGEN_LABELS,
} from '@mej-allegria/shared';
import type { StructuredHealth } from '@mej-allegria/shared';
@Component({
  selector: 'app-family-health',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="health">
      <p class="private">ESPACE SANTÉ RESTREINT</p>
      <h2>{{ pages[page()].title }}</h2>
      <p>
        Étape sanitaire {{ page() + 1 }} sur 7. Indiquez seulement ce qui est utile à l'accueil.
        Aucune réponse « non » n'est présélectionnée.
      </p>
      <p role="status">{{ status() }}</p>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (page() < 6) {
        @for (field of pages[page()].fields; track field[0]) {
          <label [for]="'health-' + field[0]">{{ field[1] }}</label
          ><textarea
            [id]="'health-' + field[0]"
            [formField]="$any(healthForm.answers)[field[0]]"
            (input)="changed()"
          ></textarea>
        }
        @if (page() === 3) {
          <h3>Besoins alimentaires pour la préparation des repas</h3>
          <p>
            Ces catégories servent seulement à une synthèse non nominative. Les consignes
            individuelles restent dans le circuit santé autorisé.
          </p>
          <div class="allergens">
            @for (a of allergens; track a) {
              <label
                ><input
                  type="checkbox"
                  [checked]="data().foodAllergens.includes(a)"
                  (change)="allergen(a, $any($event.target).checked)"
                />{{ allergenLabels[a] }}</label
              >
            }
          </div>
        }
      } @else {
        <h3>Relire la fiche complète</h3>
        <p>
          Le document reprend le modèle sanitaire fourni et une annexe lisible avec toutes les
          réponses, sans les tronquer. Les rubriques internes de vérification et d'observations ne
          sont pas remplies à votre place.
        </p>
        <a [href]="base() + '/pdf'" target="_blank" rel="noopener"
          >Ouvrir la fiche complète avant signature</a
        >
        <article class="declaration">
          <h3>Déclaration applicable</h3>
          <p>Version {{ declaration().version }}</p>
          <pre style="white-space:pre-wrap;font:inherit">{{ declaration().text }}</pre>
        </article>
        <label for="health-signer">Nom du signataire</label
        ><input id="health-signer" [formField]="healthForm.signer" /><label for="health-capacity"
          >Qualité</label
        ><select id="health-capacity" [formField]="healthForm.capacity">
          <option value="LEGAL">Représentant légal</option>
          <option value="SELF_ADULT">Adulte concerné</option></select
        ><label class="check"
          ><input type="checkbox" [formField]="healthForm.accepted" />J'ai relu la fiche complète et
          la déclaration applicable. Je souhaite attester cette version.</label
        ><button type="button" (click)="sign()" [disabled]="busy() || !model().accepted">
          Attester la fiche sanitaire
        </button>
        @if (data().signature) {
          <p>
            Attestée par {{ data().signature!.name }} le {{ data().signature!.at }}. Une
            modification demande une nouvelle attestation.
          </p>
          <a [href]="base() + '/pdf'">Télécharger la fiche et sa preuve</a>
        }
      }
      <div class="actions">
        @if (page() > 0) {
          <button type="button" (click)="go(page() - 1)" [disabled]="busy()">Précédent</button>
        }
        <button type="button" (click)="save()" [disabled]="busy()">
          Enregistrer cette page santé
        </button>
        @if (page() < 6) {
          <button type="button" (click)="go(page() + 1)" [disabled]="busy()">
            Enregistrer et continuer
          </button>
        }
      </div>
      <p class="help">
        Ces informations ne figurent pas dans les notifications ni dans la vue administrative. En
        cas de question, demandez un échange confidentiel avec l'équipe santé.
      </p>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .health {
        padding: 1rem;
        border: 1px solid #dcc8b7;
        border-radius: 10px;
      }
      .private {
        font-size: 0.8rem;
        color: #9d351b;
        letter-spacing: 0.1em;
        font-weight: 800;
      }
      label {
        display: block;
        margin: 1rem 0 0.4rem;
        font-weight: 600;
      }
      input,
      select,
      textarea {
        font: inherit;
        box-sizing: border-box;
        width: 100%;
        border: 1px solid #bba696;
        border-radius: 7px;
        padding: 0.8rem;
        min-height: 48px;
      }
      textarea {
        min-height: 100px;
      }
      button {
        font: inherit;
        font-weight: 700;
        background: #c23616;
        color: white;
        border: 0;
        border-radius: 7px;
        padding: 0.9rem;
        margin: 0.4rem 0.4rem 0.4rem 0;
        min-height: 48px;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.5;
      }
      .actions {
        margin-top: 1rem;
      }
      .allergens {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      .allergens label,
      .check {
        display: flex;
        gap: 0.6rem;
        align-items: center;
      }
      .allergens input,
      .check input {
        width: 22px;
        min-height: 22px;
      }
      .help {
        font-size: 0.9rem;
        color: #6b5a50;
      }
      .error {
        color: #a21d15;
      }
      a {
        color: #a42a11;
      }
      input:focus-visible,
      textarea:focus-visible,
      button:focus-visible,
      a:focus-visible {
        outline: 3px solid #335b88;
        outline-offset: 3px;
      }
      @media (max-width: 500px) {
        .allergens {
          grid-template-columns: 1fr;
        }
        .actions button {
          width: 100%;
        }
      }
    `,
  ],
})
export class FamilyHealthPage implements OnInit {
  readonly youthId = input.required<string>();
  private http = inject(HttpClient);
  protected declaration = signal({ text: '', version: '' });
  protected pages = HEALTH_FORM_PAGES;
  protected allergens = FOOD_ALLERGENS;
  protected allergenLabels = FOOD_ALLERGEN_LABELS;
  protected data = signal<StructuredHealth>(structuredClone(EMPTY_HEALTH));
  protected page = signal(0);
  protected busy = signal(false);
  protected status = signal('');
  protected error = signal('');
  protected model = signal({
    answers: Object.fromEntries(HEALTH_FORM_PAGES.flatMap((p) => p.fields.map((f) => [f[0], '']))),
    signer: '',
    capacity: 'LEGAL',
    accepted: false,
  });
  protected healthForm = form(this.model);
  private dirty = false;
  private generation = 0;
  private chain = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  protected base() {
    return '/api/public/family-space/youths/' + this.youthId() + '/health';
  }
  async ngOnInit() {
    try {
      this.declaration.set(
        await firstValueFrom(
          this.http.get<{ text: string; version: string }>(this.base() + '/declaration'),
        ),
      );
      const d = await firstValueFrom(this.http.get<StructuredHealth>(this.base()));
      this.data.set(d);
      this.page.set(d.page);
      this.model.update((m) => ({ ...m, answers: { ...m.answers, ...d.answers } }));
    } catch (e) {
      this.fail(e);
    }
  }
  private fail(e: unknown) {
    this.error.set(
      e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
        ? e.error.message
        : 'Sauvegarde santé impossible. Gardez cette page ouverte et réessayez.',
    );
  }
  protected changed() {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save(), 1000);
    this.dirty = true;
    this.status.set('Modification en attente. Enregistrez avant de quitter la page santé.');
  }
  protected allergen(a: string, checked: boolean) {
    this.data.update((d) => ({
      ...d,
      foodAllergens: checked
        ? [...new Set([...d.foodAllergens, a])]
        : d.foodAllergens.filter((x) => x !== a),
    }));
    this.changed();
  }
  protected save() {
    this.chain = this.chain.then(async () => {
      if (!this.dirty) return;
      this.busy.set(true);
      this.error.set('');
      const generation = this.generation;
      try {
        const d = this.data();
        const saved = await firstValueFrom(
          this.http.patch<StructuredHealth>(this.base(), {
            revision: d.revision,
            health: {
              answers: { ...this.model().answers },
              foodAllergens: [...d.foodAllergens],
              page: this.page(),
            },
          }),
        );
        this.data.update((latest) => ({
          ...saved,
          foodAllergens:
            generation === this.generation ? saved.foodAllergens : latest.foodAllergens,
        }));
        this.dirty = generation !== this.generation;
        this.status.set(
          this.dirty
            ? 'Nouvelles modifications en attente.'
            : 'Informations santé enregistrées dans l’espace restreint.',
        );
        if (this.dirty) {
          clearTimeout(this.timer);
          this.timer = setTimeout(() => void this.save(), 100);
        }
      } catch (e) {
        this.fail(e);
      } finally {
        this.busy.set(false);
      }
    });
    return this.chain;
  }
  async flush() {
    clearTimeout(this.timer);
    await this.chain;
    if (this.dirty) await this.save();
    return !this.dirty;
  }
  protected async go(page: number) {
    if (!(await this.flush())) return;
    this.page.set(page);
    this.changed();
  }
  protected async sign() {
    if (!(await this.flush())) return;
    try {
      this.busy.set(true);
      this.data.set(
        await firstValueFrom(
          this.http.post<StructuredHealth>(this.base() + '/sign', {
            revision: this.data().revision,
            name: this.model().signer,
            capacity: this.model().capacity,
            accepted: this.model().accepted,
            version: this.declaration().version,
          }),
        ),
      );
      this.status.set('Fiche attestée. Téléchargez votre exemplaire.');
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }
}
