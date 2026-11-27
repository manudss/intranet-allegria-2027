import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DIOCESES } from '@mej-allegria/shared';
import type { YouthAdministrativeSnapshot, FamilyContact } from '@mej-allegria/shared';
@Component({
  selector: 'app-family-administrative-detail',
  imports: [DatePipe],
  template: `
    <h3>Identité et participation</h3>
    <dl>
      @for (item of identityRows(); track item[0]) {
        <dt>{{ item[0] }}</dt>
        <dd>{{ item[1] || 'Non renseigné' }}</dd>
      }
    </dl>
    <h3>Responsable et contacts</h3>
    <p>{{ contactNotice() }}</p>
    <dl>
      @for (item of contactRows(); track item[0]) {
        <dt>{{ item[0] }}</dt>
        <dd>{{ item[1] || 'Non renseigné' }}</dd>
      }
    </dl>
    <h3>Organisation du séjour</h3>
    <dl>
      @for (item of logisticsRows(); track item[0]) {
        <dt>{{ item[0] }}</dt>
        <dd>{{ item[1] || 'Non renseigné' }}</dd>
      }
      <dt>Envoi du dossier</dt>
      <dd>
        {{ (youth().submittedAt | date: 'dd/MM/yyyy HH:mm' : 'Europe/Paris') || 'Non envoyé' }}
      </dd>
      <dt>Fiche sanitaire papier</dt>
      <dd>
        {{ youth().paperHealth === 'RECEIVED' ? 'Reçue' : 'Remise confidentielle à organiser' }}
      </dd>
    </dl>
    <h3>Attestations simples</h3>
    <p>Ces attestations ne sont pas des signatures avancées ou qualifiées.</p>
    @for (a of youth().signatures; track $index) {
      <section class="attestation">
        <h4>{{ a.templateId }} · version {{ a.version }}</h4>
        <dl>
          <dt>Signataire</dt>
          <dd>{{ a.signerName }}</dd>
          <dt>Qualité</dt>
          <dd>{{ label(a.capacity) }}</dd>
          <dt>Date</dt>
          <dd>{{ a.signedAt | date: 'dd/MM/yyyy HH:mm' : 'Europe/Paris' }}</dd>
          <dt>État</dt>
          <dd>
            {{ a.withdrawnAt ? 'Retirée / à renouveler' : 'Active' }}
            @if (a.withdrawnAt) {
              depuis {{ a.withdrawnAt | date: 'dd/MM/yyyy HH:mm' : 'Europe/Paris' }}
            }
          </dd>
          <dt>Empreinte du contenu</dt>
          <dd class="digest">{{ a.digest }}</dd>
        </dl>
      </section>
    } @empty {
      <p>Aucune attestation.</p>
    }
  `,
  styles: [
    `
      dl {
        line-height: 1.5;
      }
      dt {
        font-weight: 600;
      }
      dd {
        margin: 0 0 0.65rem;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .attestation {
        border: 1px solid var(--tui-border-normal);
        border-radius: 8px;
        padding: 0.75rem;
        margin: 0.6rem 0;
      }
      .digest {
        font-family: monospace;
        font-size: 0.8rem;
      }
      h3 {
        margin-top: 1.3rem;
      }
    `,
  ],
})
export class FamilyAdministrativeDetail {
  readonly youth = input.required<YouthAdministrativeSnapshot>();
  readonly contact = input.required<FamilyContact>();
  readonly email = input('');
  readonly contactNotice = input('');
  label(value: string) {
    return (
      (
        {
          FEMALE: 'Féminin',
          MALE: 'Masculin',
          OTHER: 'Autre',
          UNDISCLOSED: 'Non communiqué',
          LEGAL: 'Représentant légal',
          SELF_ADULT: 'Jeune majeur pour lui-même',
          FULL: 'Séjour complet',
          PARTIAL: 'Présence partielle',
        } as Record<string, string>
      )[value] || value
    );
  }
  diocese() {
    const i = this.youth().identity;
    return i.dioceseId === 'UNKNOWN'
      ? 'Je ne sais pas encore'
      : i.dioceseId === 'OTHER'
        ? 'Autre : ' + i.otherDiocese
        : DIOCESES.find((d) => d.id === i.dioceseId)?.name || i.dioceseId;
  }
  birthDate(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
  }
  identityRows() {
    const i = this.youth().identity;
    return [
      ['Prénom', i.firstName],
      ['Nom', i.lastName],
      ['Naissance', this.birthDate(i.dateOfBirth)],
      ['Sexe', this.label(i.sex)],
      ['Tranche MEJ', i.mejAgeGroup],
      ['Diocèse ou juridiction', this.diocese()],
      ['Autre diocèse / pays', i.otherDiocese],
      ['Ville du jeune', i.city],
      ['Équipe / groupe MEJ', i.mejGroup],
      ['Qualité du responsable', this.label(i.legalCapacity)],
    ];
  }
  contactRows() {
    const c = this.contact();
    return [
      ['Responsable', c.name],
      ['Téléphone', c.phone],
      ['E-mail de l’espace', this.email()],
      ['Adresse', c.address],
      ['Code postal', c.postalCode],
      ['Ville du foyer', c.city],
      ['Contact d’urgence', c.emergencyName],
      ['Téléphone d’urgence', c.emergencyPhone],
    ];
  }
  logisticsRows() {
    const l = this.youth().logistics;
    return [
      ['Participation', this.label(l.presence)],
      ['Hébergement', l.accommodation],
      ['Notes administratives', l.notes],
    ];
  }
}
