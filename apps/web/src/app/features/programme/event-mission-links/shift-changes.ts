import { Component, input } from '@angular/core';

import { EventShiftTimingDiff } from '../../../models/models';
@Component({
  selector: 'app-shift-changes',
  imports: [],
  template: ` @if (changes().length) {
    <section aria-label="Effets sur les créneaux bénévoles">
      <h4>Créneaux bénévoles liés · {{ changes().length }}</h4>
      @for (d of changes(); track d.shiftId) {
        <p>
          <strong>{{ d.title }} · créneau #{{ d.shiftId }}</strong
          ><br />
          Avant : {{ date(d.before.startAt) }} → {{ date(d.before.endAt) }}<br />
          Après : {{ date(d.after.startAt) }} → {{ date(d.after.endAt) }}
        </p>
      }
    </section>
  }`,
  styles: [
    `
      section {
        border: 1px solid var(--tui-border-normal);
        border-radius: 0.5rem;
        padding: 1rem;
        margin: 1rem 0;
      }
      p {
        font-size: 0.85rem;
        line-height: 1.6;
      }
    `,
  ],
})
export class ShiftChangesComponent {
  date(value: string) {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }
  readonly changes = input<EventShiftTimingDiff[]>([]);
}
