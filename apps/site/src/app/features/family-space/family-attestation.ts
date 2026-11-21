import { ChangeDetectionStrategy, Component, input, output, signal, OnInit } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
export interface AttestationInput {
  name: string;
  capacity: string;
  accepted: boolean;
}
/** Each document owns its own consent. Checking one never checks another. */
@Component({
  selector: 'app-family-attestation',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<form (submit)="$event.preventDefault(); attest()">
    <label [for]="'signer-' + documentId()">Nom du signataire</label
    ><input [id]="'signer-' + documentId()" [formField]="fields.name" autocomplete="name" />
    <label [for]="'capacity-' + documentId()">Votre qualité pour ce document</label
    ><select [id]="'capacity-' + documentId()" [formField]="fields.capacity">
      <option value="LEGAL">Représentant légal</option>
      <option value="SELF_ADULT">Adulte concerné</option>
    </select>
    <label class="check"
      ><input type="checkbox" [formField]="fields.accepted" />J'ai lu cette version pour ce jeune et
      je souhaite l'attester.</label
    >
    <button type="submit" [disabled]="busy() || !model().accepted || !model().name.trim()">
      Attester ce document
    </button>
    <p>
      Attestation simple liée à votre accès e-mail vérifié. Ni signature avancée ni signature
      qualifiée. Aucun dessin n'est obligatoire : cette action reste utilisable au clavier.
    </p>
  </form>`,
  styles: [
    `
      label {
        display: block;
        margin: 1rem 0 0.4rem;
        font-weight: 650;
      }
      input,
      select {
        font: inherit;
        width: 100%;
        box-sizing: border-box;
        min-height: 48px;
        padding: 0.8rem;
        border: 1px solid #887467;
        border-radius: 7px;
        background: white;
        color: #302721;
      }
      .check {
        display: flex;
        gap: 0.6rem;
        align-items: flex-start;
      }
      .check input {
        width: 24px;
        min-width: 24px;
        min-height: 24px;
      }
      button {
        font: inherit;
        font-weight: 700;
        min-height: 48px;
        padding: 0.8rem 1rem;
        border: 1px solid #c23616;
        border-radius: 7px;
        background: #c23616;
        color: white;
        margin-top: 1rem;
      }
      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      input:focus-visible,
      select:focus-visible,
      button:focus-visible {
        outline: 3px solid #254c8c;
        outline-offset: 3px;
      }
      p {
        font-size: 0.9rem;
        line-height: 1.6;
        color: #6b5a50;
      }
    `,
  ],
})
export class FamilyAttestation implements OnInit {
  readonly documentId = input.required<string>();
  readonly signer = input('');
  readonly capacity = input('LEGAL');
  readonly busy = input(false);
  readonly accepted = output<AttestationInput>();
  protected model = signal<AttestationInput>({ name: '', capacity: 'LEGAL', accepted: false });
  protected fields = form(this.model);
  ngOnInit() {
    this.model.update((m) => ({ ...m, name: this.signer(), capacity: this.capacity() }));
  }
  protected attest() {
    const value = this.model();
    if (this.busy() || !value.accepted || !value.name.trim()) return;
    this.accepted.emit({ ...value });
    this.model.update((m) => ({ ...m, accepted: false }));
  }
}
