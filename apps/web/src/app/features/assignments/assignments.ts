import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { forkJoin } from 'rxjs';
import {
  AssignmentPayload,
  AssignmentStatus,
  HostFamily,
  Participant,
  ParticipantHostFamilyAssignment,
} from '../../models/models';
import {
  AssignmentsApiService,
  HostFamiliesApiService,
  ParticipantsApiService,
} from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
const blank = (): AssignmentPayload => ({
  participantId: 0,
  hostFamilyId: 0,
  arrivalDate: '2027-07-19',
  departureDate: '2027-07-27',
  status: AssignmentStatus.PLANNED,
  notes: '',
});
@Component({
  selector: 'app-assignments',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  template: `<app-page-layout title="Hébergement" description="Affectations des participants"
      ><button actions tuiButton (click)="create()">Nouvelle affectation</button>
      <tui-textfield iconStart="@tui.search">
        <label tuiLabel>Rechercher</label>
        <input tuiInput placeholder="Participant, famille…" [value]="query()" (input)="query.set($any($event.target).value)" />
      </tui-textfield>
      @if (loading()) {
        <tui-loader />
      } @else {
        <cdk-virtual-scroll-viewport itemSize="58" class="viewport"
          ><div class="table-head"><b>Participant</b><b>Famille</b><b>Statut</b></div>
          <button class="row" *cdkVirtualFor="let x of filtered()" (click)="open(x)">
            <span>{{ x.participant.lastName }} {{ x.participant.firstName }}</span
            ><span>{{ x.hostFamily.familyName }}</span
            ><span
              ><span tuiBadge>{{ x.status }}</span></span
            >
          </button></cdk-virtual-scroll-viewport
        >
      }
    </app-page-layout>
    @if (opened()) {
      <tui-drawer direction="end"
        ><header>
          <h2>
            {{ mode() === 'create' ? 'Nouvelle affectation' : 'Affectation #' + selected()?.id }}
          </h2>
        </header>
        @if (mode() === 'detail') {
          <dl>
            <dt>Participant</dt>
            <dd>
              {{ selected()?.participant?.firstName }} {{ selected()?.participant?.lastName }}
            </dd>
            <dt>Famille</dt>
            <dd>{{ selected()?.hostFamily?.familyName }}</dd>
            <dt>Période</dt>
            <dd>{{ selected()?.arrivalDate }} – {{ selected()?.departureDate }}</dd>
            <dt>Statut</dt>
            <dd>{{ selected()?.status }}</dd>
            <dt>Notes</dt>
            <dd>{{ selected()?.notes || '—' }}</dd>
          </dl>
         } @else {
           <form class="drawer-form">
             <tui-textfield iconStart="@tui.user">
               <label tuiLabel>Participant</label>
               <select tuiSelect [value]="model().participantId" (change)="model.update(x=>({...x,participantId:+$any($event.target).value}))">
                 <option [value]="0">Sélectionner…</option>
                 @for (p of participants(); track p.id) {
                   <option [value]="p.id">{{ p.lastName }} {{ p.firstName }}</option>
                 }
               </select>
             </tui-textfield>
             <tui-textfield iconStart="@tui.home">
               <label tuiLabel>Famille d'accueil</label>
               <select tuiSelect [value]="model().hostFamilyId" (change)="model.update(x=>({...x,hostFamilyId:+$any($event.target).value}))">
                 <option [value]="0">Sélectionner…</option>
                 @for (f of families(); track f.id) {
                   <option [value]="f.id">{{ f.familyName }}</option>
                 }
               </select>
             </tui-textfield>
             <tui-textfield iconStart="@tui.calendar">
               <label tuiLabel>Arrivée</label>
               <input tuiInput type="date" [formField]="assignmentForm.arrivalDate" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.calendar">
               <label tuiLabel>Départ</label>
               <input tuiInput type="date" [formField]="assignmentForm.departureDate" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.circle-check">
               <label tuiLabel>Statut</label>
               <select tuiSelect [formField]="assignmentForm.status">
                 @for (s of statuses; track s) {
                   <option [value]="s">{{ s }}</option>
                 }
               </select>
             </tui-textfield>
             <tui-textfield iconStart="@tui.file-text" class="wide">
               <label tuiLabel>Notes</label>
               <textarea tuiTextarea [formField]="$any(assignmentForm.notes)"></textarea>
             </tui-textfield>
           </form>
         }
        <footer>
          <button tuiButton appearance="flat" (click)="opened.set(false)">Fermer</button>
          @if (mode() === 'detail') {
            <button tuiButton (click)="edit()">Modifier</button
            ><button tuiButton appearance="secondary-destructive" (click)="remove()">
              Supprimer
            </button>
          } @else {
            <button tuiButton (click)="save()">Enregistrer</button>
          }
        </footer></tui-drawer
      >
    }`,
  styleUrl: '../../shared/crud.scss',
})
export class AssignmentsPage implements OnInit {
  private api = inject(AssignmentsApiService);
  private participantsApi = inject(ParticipantsApiService);
  private familiesApi = inject(HostFamiliesApiService);
  items = signal<ParticipantHostFamilyAssignment[]>([]);
  participants = signal<Participant[]>([]);
  families = signal<HostFamily[]>([]);
  query = signal('');
  loading = signal(true);
  opened = signal(false);
  mode = signal<'detail' | 'create' | 'edit'>('detail');
  selected = signal<ParticipantHostFamilyAssignment | null>(null);
  model = signal<AssignmentPayload>(blank());
  assignmentForm = form(this.model, (p) => {
    required(p.participantId);
    required(p.hostFamilyId);
    required(p.arrivalDate);
    required(p.departureDate);
  });
  statuses = Object.values(AssignmentStatus);
  filtered = computed(() => {
    const q = this.query().toLowerCase();
    return this.items().filter((x) =>
      `${x.participant.firstName} ${x.participant.lastName} ${x.hostFamily.familyName} ${x.status}`
        .toLowerCase()
        .includes(q),
    );
  });
  ngOnInit() {
    forkJoin({
      items: this.api.list(),
      participants: this.participantsApi.list(),
      families: this.familiesApi.list(),
    }).subscribe((x) => {
      this.items.set(x.items);
      this.participants.set(x.participants);
      this.families.set(x.families);
      this.loading.set(false);
    });
  }
  open(x: ParticipantHostFamilyAssignment) {
    this.selected.set(x);
    this.mode.set('detail');
    this.opened.set(true);
  }
  create() {
    this.model.set(blank());
    this.mode.set('create');
    this.opened.set(true);
  }
  edit() {
    const x = this.requireSelectedAssignment();
    this.model.set({
      participantId: x.participant.id,
      hostFamilyId: x.hostFamily.id,
      arrivalDate: x.arrivalDate,
      departureDate: x.departureDate,
      status: x.status,
      notes: x.notes ?? '',
    });
    this.mode.set('edit');
  }
  save() {
    submit(this.assignmentForm, async () => {
      const req =
        this.mode() === 'create'
          ? this.api.create(this.model())
          : this.api.update(this.requireSelectedAssignment().id, this.model());
      req.subscribe((x) => {
        this.items.update((a) =>
          this.mode() === 'create' ? [x, ...a] : a.map((i) => (i.id === x.id ? x : i)),
        );
        this.open(x);
      });
    });
  }
  remove() {
    const x = this.requireSelectedAssignment();
    if (confirm(`Supprimer l'affectation #${x.id} ?`))
      this.api.delete(x.id).subscribe(() => {
        this.items.update((a) => a.filter((i) => i.id !== x.id));
        this.opened.set(false);
      });
  }
  private requireSelectedAssignment(): ParticipantHostFamilyAssignment {
    const assignment = this.selected();
    if (!assignment) {
      throw new Error('No assignment selected');
    }
    return assignment;
  }
}
