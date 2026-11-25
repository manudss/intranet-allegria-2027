import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_FAMILY_RULES } from '@mej-allegria/shared';
import type { FamilyRules, FamilyDocumentTemplate } from '@mej-allegria/shared';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { FamilyRegistrationsApiService } from '../../services/api.services';
@Component({
  selector: 'app-family-rules-editor',
  imports: [...SHARED_IMPORTS],
  template: `<section>
    <h3>1. Fixer les règles du rassemblement</h3>
    <p>Les bornes d'âge sont facultatives. La date de référence est nécessaire avant ouverture.</p>
    <div class="fields">
      @for (field of fields; track field.key) {
        <tui-textfield
          ><label tuiLabel [for]="'rule-' + field.key">{{ field.label }}</label
          ><input
            tuiInput
            [id]="'rule-' + field.key"
            [value]="$any(rules())[field.key] ?? ''"
            (input)="set(field.key, $any($event.target).value)"
            [placeholder]="field.key === 'ageReferenceDate' ? '2027-10-30' : 'Sans limite'"
        /></tui-textfield>
      }
    </div>
    <h3>2. Préparer les textes à faire relire</h3>
    <label for="final-declaration">Déclaration de l'envoi final</label
    ><tui-textfield style="min-height:150px">
      <textarea
        tuiTextarea
        [min]="5"
        id="final-declaration"
        [ngModel]="rules().finalDeclaration"
        (ngModelChange)="set('finalDeclaration', $event)"
      ></textarea>
    </tui-textfield>
    <p>La déclaration sanitaire est distincte et ne s'active pas depuis cet écran.</p>
    <h3>3. Vérifier chaque document et sa version</h3>
    @for (t of rules().templates; track $index; let i = $index) {
      <article>
        <div class="fields">
          @for (field of templateFields; track field.key) {
            <tui-textfield
              ><label tuiLabel [for]="'template-' + i + '-' + field.key">{{ field.label }}</label
              ><input
                tuiInput
                [id]="'template-' + i + '-' + field.key"
                [value]="$any(t)[field.key]"
                (input)="template(i, field.key, $any($event.target).value)"
            /></tui-textfield>
          }
        </div>
        <label [for]="'template-text-' + i">Texte intégral validé</label
        ><tui-textfield style="min-height:180px">
          <textarea
            tuiTextarea
            [min]="5"
            [id]="'template-text-' + i"
            [ngModel]="t.text"
            (ngModelChange)="template(i, 'text', $event)"
          ></textarea></tui-textfield
        ><label class="check"
          ><input
            type="checkbox"
            tuiCheckbox
            [checked]="t.enabled"
            (change)="template(i, 'enabled', $any($event.target).checked)"
          />Proposer ce document</label
        ><label class="check"
          ><input
            type="checkbox"
            tuiCheckbox
            [checked]="t.required"
            (change)="template(i, 'required', $any($event.target).checked)"
          />Attestation requise avant envoi</label
        >
      </article>
    }
    <button tuiButton appearance="secondary" (click)="add()">Ajouter un modèle</button>
    <h3>4. Ouvrir lorsque tout est prêt</h3>
    <label class="check"
      ><input
        type="checkbox"
        tuiCheckbox
        [checked]="rules().registrationOpen"
        (change)="set('registrationOpen', $any($event.target).checked)"
      />Autoriser l'envoi final des dossiers</label
    >
    <p>
      Les brouillons restent possibles même quand l'envoi final est fermé. La collecte santé
      nécessite toujours un circuit distinct préalablement validé.
    </p>
    <button tuiButton (click)="save()" [disabled]="busy()">
      Enregistrer les règles et versions
    </button>
    <p role="status">{{ status() }}</p>
  </section>`,
  styles: [
    `
      .fields {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
        gap: 1rem;
      }
      article {
        padding: 1rem;
        border: 1px solid var(--tui-border-normal);
        border-radius: 12px;
        margin: 1rem 0;
      }
      .check {
        display: flex;
        gap: 0.7rem;
        align-items: center;
        margin: 1rem 0;
      }
      tui-textfield {
        margin: 1rem 0;
      }
    `,
  ],
})
export class FamilyRulesEditor implements OnInit {
  private api = inject(FamilyRegistrationsApiService);
  protected rules = signal<FamilyRules>(structuredClone(DEFAULT_FAMILY_RULES));
  protected busy = signal(false);
  protected status = signal('');
  protected fields = [
    { key: 'ageReferenceDate', label: 'Date de référence des âges (AAAA-MM-JJ)' },
    { key: 'minAge', label: 'Âge minimum inclus' },
    { key: 'maxAge', label: 'Âge maximum inclus' },
  ];
  protected templateFields = [
    { key: 'id', label: 'Identifiant stable' },
    { key: 'title', label: 'Titre du document' },
    { key: 'version', label: 'Version du texte' },
  ];
  async ngOnInit() {
    try {
      this.rules.set(await firstValueFrom(this.api.rules()));
    } catch {
      this.status.set('Règles non chargées. Aucun changement enregistré.');
    }
  }
  protected set(key: string, value: string | boolean) {
    this.rules.update((r) => ({
      ...r,
      [key]: ['minAge', 'maxAge'].includes(key) ? (value === '' ? null : Number(value)) : value,
    }));
  }
  protected template(i: number, key: string, value: string | boolean) {
    this.rules.update((r) => ({
      ...r,
      templates: r.templates.map((t, n) => (n === i ? { ...t, [key]: value } : t)),
    }));
  }
  protected add() {
    this.rules.update((r) => ({
      ...r,
      templates: [
        ...r.templates,
        {
          id: '',
          title: '',
          version: '',
          text: '',
          enabled: false,
          required: false,
        } as FamilyDocumentTemplate,
      ],
    }));
  }
  protected async save() {
    this.busy.set(true);
    try {
      this.rules.set(await firstValueFrom(this.api.configure(this.rules())));
      this.status.set('Règles enregistrées.');
    } catch {
      this.status.set(
        'Enregistrement refusé. Vérifiez les dates, identifiants uniques et versions. Modifier un texte exige une nouvelle version.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
