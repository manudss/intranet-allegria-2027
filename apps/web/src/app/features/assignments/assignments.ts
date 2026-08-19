import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TuiButton, TuiCheckbox, TuiInput, TuiLabel } from '@taiga-ui/core';
import { TuiChip, TuiDataListWrapper, TuiDrawer, TuiSelect, TuiTabs } from '@taiga-ui/kit';
import { debounceTime, distinctUntilChanged, finalize, forkJoin, startWith, switchMap } from 'rxjs';
import {
  AssignmentPayload,
  AssignmentStatus,
  HostFamily,
  Participant,
  ParticipantHostFamilyAssignment,
  PersonType,
} from '../../models/models';
import { AssignmentsApiService, HostFamiliesApiService, ParticipantsApiService } from '../../services/api.services';
import { DataTableColumn } from '../../shared/data-table';
import { SHARED_IMPORTS } from '../../shared/shared-imports';

@Component({
  selector: 'app-host-family-cards',
  imports: [TuiChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="cards">@for (family of families(); track family.id) {
    <button class="family-card" type="button" (click)="selectFamily.emit(family)">
      <strong>{{ family.familyName }}</strong><span>{{ family.city }} · {{ family.parish || 'Sans paroisse' }}</span>
      <span>Capacité : {{ family.maxCapacity }} places</span>
      <span class="chips">@for (tag of family.tags || []; track tag) { <span tuiChip>{{ tag }}</span> }</span>
    </button>
  } @empty { <p>Aucune famille enregistrée.</p> }</div>`,
  styles: `.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:1rem}.family-card{display:flex;flex-direction:column;gap:.5rem;padding:1rem;border:1px solid var(--tui-border-normal);border-radius:1rem;background:var(--tui-background-base);text-align:start;cursor:pointer}.family-card:hover{box-shadow:var(--tui-shadow-small)}.chips{display:flex;flex-wrap:wrap;gap:.25rem}`,
})
export class HostFamilyCardsComponent {
  readonly families = input.required<readonly HostFamily[]>();
  readonly selectFamily = output<HostFamily>();
}

@Component({
  selector: 'app-host-family-assignments-selector',
  imports: [ReactiveFormsModule, TuiButton, TuiCheckbox, TuiDataListWrapper, TuiInput, TuiLabel, TuiSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="selector"><h3>Ajouter des personnes</h3>
    <form [formGroup]="filters"><label><input tuiCheckbox type="checkbox" formControlName="unassignedOnly" /> Non affectés uniquement</label>
      <tui-textfield tuiChevron><label tuiLabel>Type</label><input tuiSelect formControlName="type" /><tui-data-list-wrapper *tuiDropdown [items]="types" /></tui-textfield>
      <tui-textfield><label tuiLabel>Équipe</label><input tuiInput type="number" formControlName="teamId" /></tui-textfield>
      <tui-textfield><label tuiLabel>Recherche</label><input tuiInput formControlName="q" /></tui-textfield>
    </form>
    <div class="results">@for (participant of participants(); track participant.id) {
      <label><input tuiCheckbox type="checkbox" [checked]="isSelected(participant.id)" (change)="toggle(participant.id)" />
        <span>{{ participant.lastName }} {{ participant.firstName }} · {{ participant.type }}</span></label>
    } @empty { <p>Aucun participant disponible.</p> }</div>
    <div class="dates"><label>Arrivée <input type="date" [formControl]="arrivalDate" /></label><label>Départ <input type="date" [formControl]="departureDate" /></label></div>
    <button tuiButton type="button" [disabled]="!selectedIds().length || saving()" (click)="addSelected()">Ajouter {{ selectedIds().length }} sélectionné(s)</button>
  </section>`,
  styles: `.selector{display:grid;gap:1rem}.selector form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}.results{display:grid;gap:.5rem;max-block-size:15rem;overflow:auto}.results label,.selector>form>label{display:flex;align-items:center;gap:.5rem}.dates{display:flex;gap:1rem;flex-wrap:wrap}.dates label{display:grid;gap:.25rem}@media(max-width:40rem){.selector form{grid-template-columns:1fr}}`,
})
export class HostFamilyAssignmentsSelectorComponent {
  private readonly participantsApi = inject(ParticipantsApiService);
  private readonly assignmentsApi = inject(AssignmentsApiService);
  readonly family = input.required<HostFamily>();
  readonly currentAssignments = input.required<readonly ParticipantHostFamilyAssignment[]>();
  readonly assign = output<{ participantIds: number[] }>();
  readonly changed = output<void>();
  readonly types: readonly (PersonType | null)[] = [null, 'JEUNE', 'ANIMATEUR', 'BENEVOLE'];
  readonly participants = signal<Participant[]>([]);
  readonly selectedIds = signal<number[]>([]);
  readonly saving = signal(false);
  readonly arrivalDate = new FormControl('2027-07-19', { nonNullable: true });
  readonly departureDate = new FormControl('2027-07-27', { nonNullable: true });
  readonly filters = new FormGroup({
    unassignedOnly: new FormControl(true, { nonNullable: true }),
    type: new FormControl<PersonType | null>(null),
    teamId: new FormControl<number | null>(null),
    q: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.filters.valueChanges.pipe(startWith(this.filters.getRawValue()), debounceTime(300), distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)), switchMap((filters) => this.participantsApi.search(filters))).subscribe((result) => this.participants.set(result.items));
  }
  isSelected(id: number): boolean { return this.selectedIds().includes(id); }
  toggle(id: number): void { this.selectedIds.update((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]); }
  addSelected(): void {
    const ids = this.selectedIds();
    const byId = new Map(this.participants().map((participant) => [participant.id, participant]));
    const payloads: AssignmentPayload[] = ids.map((participantId) => ({ participantId, hostFamilyId: this.family().id, type: byId.get(participantId)?.type ?? 'JEUNE', groupId: byId.get(participantId)?.group?.id ?? null, roomLabel: null, arrivalDate: this.arrivalDate.value, departureDate: this.departureDate.value, status: AssignmentStatus.PENDING, notes: '' }));
    this.saving.set(true);
    forkJoin(payloads.map((payload) => this.assignmentsApi.create(payload))).pipe(finalize(() => this.saving.set(false))).subscribe(() => { this.assign.emit({ participantIds: ids }); this.selectedIds.set([]); this.changed.emit(); });
  }
}

@Component({
  selector: 'app-host-family-detail-drawer',
  imports: [TuiButton, TuiChip, TuiDrawer, TuiTabs, HostFamilyAssignmentsSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (family(); as current) { <tui-drawer direction="end" [overlay]="true">
    <header><h2>{{ current.familyName }}</h2><p>{{ current.city }} · {{ current.parish || 'Sans paroisse' }} · {{ assignments()?.length || 0 }}/{{ current.maxCapacity }}</p>
      <tui-tabs [(activeItemIndex)]="tab"><button tuiTab type="button">Infos famille</button><button tuiTab type="button">Personnes hébergées</button></tui-tabs></header>
    @if (tab === 0) { <dl><dt>Adresse</dt><dd>{{ current.address }}, {{ current.postalCode }} {{ current.city }}</dd><dt>Contact</dt><dd>{{ current.phone }} · {{ current.email }}</dd><dt>Capacités</dt><dd>{{ current.maxUnder18 }} mineurs · {{ current.maxAnimators ?? 0 }} animateurs</dd></dl>
      <div class="chips">@for (tag of current.tags || []; track tag) { <span tuiChip>{{ tag }}</span> } @for (constraint of current.constraints || []; track constraint) { <span tuiChip appearance="warning">{{ constraint }}</span> }</div>
    } @else { <div class="assignments">@for (assignment of assignments() || []; track assignment.id) { <article><span><strong>{{ assignment.participant.lastName }} {{ assignment.participant.firstName }}</strong><small>{{ assignment.type }} · {{ assignment.groupId || 'sans groupe' }}</small></span><span>{{ assignment.arrivalDate }} → {{ assignment.departureDate }} · {{ assignment.status }}</span><button tuiButton size="s" appearance="secondary-destructive" type="button" (click)="remove(assignment.id)">Retirer</button></article> }
      <app-host-family-assignments-selector [family]="current" [currentAssignments]="assignments() || []" (changed)="changed.emit()" />
    </div> }
    <footer><button tuiButton appearance="flat" type="button" (click)="close.emit()">Fermer</button></footer>
  </tui-drawer> }`,
  styles: `:host tui-drawer{inline-size:min(42rem,100vw)}header,footer{position:sticky;z-index:1;background:var(--tui-background-base)}.chips{display:flex;flex-wrap:wrap;gap:.4rem}.assignments{display:grid;gap:1rem}.assignments article{display:flex;align-items:center;justify-content:space-between;gap:1rem;border-block-end:1px solid var(--tui-border-normal);padding-block:.75rem}.assignments article span:first-child{display:grid}.assignments small{color:var(--tui-text-secondary)}`,
})
export class HostFamilyDetailDrawerComponent {
  private readonly assignmentsApi = inject(AssignmentsApiService);
  readonly family = input<HostFamily | null>(null);
  readonly assignments = input<ParticipantHostFamilyAssignment[] | null>(null);
  readonly close = output<void>();
  readonly changed = output<void>();
  tab = 0;
  remove(id: number): void { this.assignmentsApi.delete(id).subscribe(() => this.changed.emit()); }
}

@Component({
  selector: 'app-assignments',
  imports: [...SHARED_IMPORTS, TuiTabs, HostFamilyCardsComponent, HostFamilyDetailDrawerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-page-layout title="Hébergement – Familles d’accueil" description="Capacités et affectations">
    <tui-tabs [(activeItemIndex)]="view"><button tuiTab type="button">Table</button><button tuiTab type="button">Cards</button></tui-tabs>
    @if (loading()) { <tui-loader /> } @else if (view === 0) { <app-data-table [rows]="families()" [columns]="tableColumns" (rowSelected)="select($event)" /> } @else { <app-host-family-cards [families]="families()" (selectFamily)="select($event)" /> }
  </app-page-layout>
  @if (selectedFamily()) { <app-host-family-detail-drawer [family]="selectedFamily()" [assignments]="selectedFamilyAssignments()" (close)="closeDrawer()" (changed)="reloadAssignments()" /> }`,
})
export class AssignmentsPage implements OnInit {
  private readonly api = inject(HostFamiliesApiService);
  readonly families = signal<HostFamily[]>([]);
  readonly selectedFamily = signal<HostFamily | null>(null);
  readonly selectedFamilyAssignments = signal<ParticipantHostFamilyAssignment[] | null>(null);
  readonly loading = signal(true);
  view = 0;
  readonly tableColumns: readonly DataTableColumn<HostFamily>[] = [
    { key: 'family', label: 'Famille', value: (family) => family.familyName, presentation: { type: 'icon', icon: () => '@tui.house' } },
    { key: 'city', label: 'Ville', type: 'list', value: (family) => family.city },
    { key: 'parish', label: 'Paroisse', type: 'list', value: (family) => family.parish || '—' },
    { key: 'capacity', label: 'Capacité', type: 'number', value: (family) => family.maxCapacity, presentation: { type: 'number' } },
    { key: 'status', label: 'Statut', type: 'list', value: (family) => family.status, presentation: { type: 'badge' } },
  ];
  ngOnInit(): void { this.api.list().pipe(finalize(() => this.loading.set(false))).subscribe((families) => this.families.set(families)); }
  select(family: HostFamily): void { this.selectedFamily.set(family); this.reloadAssignments(); }
  reloadAssignments(): void { const family = this.selectedFamily(); if (family) this.api.getAssignments(family.id).subscribe((assignments) => this.selectedFamilyAssignments.set(assignments)); }
  closeDrawer(): void { this.selectedFamily.set(null); this.selectedFamilyAssignments.set(null); }
}
