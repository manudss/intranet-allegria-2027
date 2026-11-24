import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageLayoutComponent } from '../../shared/ui-components';

interface Terme {
  readonly terme: string;
  readonly definition: string;
}

/** Vocabulaire commun de l'intranet : un seul nom par notion, utilisé partout. */
@Component({
  selector: 'app-glossaire',
  standalone: true,
  imports: [PageLayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-layout title="Glossaire">
      <dl>
        @for (t of termes; track t.terme) {
          <dt>{{ t.terme }}</dt>
          <dd>{{ t.definition }}</dd>
        }
      </dl>
    </app-page-layout>
  `,
  styles: [
    `
      dl { display: grid; grid-template-columns: minmax(10rem, 16rem) 1fr; gap: 0.75rem 1.5rem; margin: 0; }
      dt { font-weight: 600; }
      dd { margin: 0; }
      @media (max-width: 600px) { dl { grid-template-columns: 1fr; } dd { margin-bottom: 0.5rem; } }
    `,
  ],
})
export class GlossairePage {
  protected readonly termes: readonly Terme[] = [
    { terme: 'Alegria', definition: "Nom de l'événement (et non « Allegria »). Rassemblement du 31/10/2027 au 03/11/2027." },
    { terme: 'J1 à J4', definition: "Les quatre jours du rassemblement : dimanche 31/10, lundi 01/11, mardi 02/11 et mercredi 03/11/2027." },
    { terme: 'Jour J', definition: "Les écrans utilisés sur place pendant le rassemblement (accueil, contrôle d'accès)." },
    { terme: 'Participant', definition: 'Personne inscrite au rassemblement.' },
    { terme: 'Groupe', definition: 'Ensemble de participants qui arrivent et sont hébergés ensemble.' },
    { terme: 'Équipe', definition: 'Équipe de bénévoles ayant une mission commune.' },
    { terme: 'Famille d\u2019accueil', definition: 'Famille qui héberge des participants pendant le rassemblement.' },
    { terme: 'Bénévole', definition: 'Personne qui aide à l\u2019organisation, affectée à des créneaux de missions.' },
    { terme: 'Affectation', definition: 'Lien entre une personne ou un groupe et une famille, une équipe ou un créneau. Statuts : provisoire, confirmée, annulée.' },
    { terme: 'Badge', definition: 'Support d\u2019identification scanné au contrôle d\u2019accès.' },
    { terme: 'Formats', definition: 'Dates au format jj/mm/aaaa, heures sur 24 h (par exemple 14:30).' },
  ];
}
