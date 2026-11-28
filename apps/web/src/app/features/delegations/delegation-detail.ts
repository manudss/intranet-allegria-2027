import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { concat, forkJoin, last, of } from 'rxjs';
import { RoleFilter, dragPayload, entryKeyOf, filterPeople } from './repartition-panels';
import { DEFAULT_DATE_BY_DIRECTION, TransportTimes, composeIso, defaultTimes, splitIso } from './transport-dates';
import { Group } from '../../models/models';
import { GroupsApiService } from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { SelectFieldComponent, SelectOption } from '../../shared/select-field.component';
import {
  AssignmentEntry,
  DelegationStats,
  DelegationsApiService,
  PersonLite,
  Repartition,
  RepartitionTransport,
  TransportDirection,
  TransportPayload,
} from './delegations-api.service';

const MODE_LABELS: Record<string, string> = {
  TRAIN: 'Train',
  CAR: 'Car',
  VOITURES: 'Voitures individuelles',
  AUTRE: 'Autre',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  );
}

/**
 * Fiche délégation côté transports : sous-délégations aller/retour, répartition des
 * personnes (à placer, placées, exceptions) et création d'exceptions.
 * Le périmètre est appliqué côté serveur : un responsable ne voit que sa
 * délégation, sans jamais exposer de données de santé.
 */
@Component({
  selector: 'app-delegation-detail',
  standalone: true,
  imports: [...SHARED_IMPORTS, RouterLink, SelectFieldComponent],
  templateUrl: './delegation-detail.html',
  styleUrls: ['../../shared/crud.scss', './delegation-detail.scss'],
})
export class DelegationDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(DelegationsApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly groupsApi = inject(GroupsApiService);

  protected readonly modeLabels = MODE_LABELS;
  protected readonly fmt = formatDateTime;
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly delegation = signal<Group | null>(null);
  protected readonly groups = signal<Group[]>([]);
  protected readonly direction = signal<TransportDirection>('ALLER');
  protected readonly repartition = signal<Repartition | null>(null);
  protected readonly stats = signal<DelegationStats | null>(null);

  protected readonly transportForm = signal<TransportPayload>(this.emptyTransport());
  protected readonly transportTimes = signal<TransportTimes>(defaultTimes('ALLER'));
  protected readonly editingTransportId = signal<number | null>(null);
  protected readonly exceptionForm = signal({
    personKey: '',
    toDelegationId: null as number | null,
    note: '',
  });
  protected readonly assignTargets = signal<Record<string, number | null>>({});
  protected readonly members = signal<PersonLite[]>([]);
  protected readonly toAssignSearch = signal('');
  protected readonly toAssignShowAll = signal(false);
  // Refonte : onglets, deux panneaux, sélection, glisser-déposer, tiroirs.
  protected readonly view = signal<'repartition' | 'exceptions'>('repartition');
  protected readonly step = signal<'personnes' | 'destinations'>('personnes');
  protected readonly roleFilter = signal<RoleFilter>('ALL');
  protected readonly selectedKeys = signal<ReadonlySet<string>>(new Set());
  protected readonly bulkTarget = signal<number | null>(null);
  protected readonly drawer = signal<'transport' | 'exception' | null>(null);
  protected readonly dragOverId = signal<number | null>(null);
  protected readonly assigning = signal(false);
  protected readonly roleOptions: RoleFilter[] = ['ALL', 'PARTICIPANT', 'VOLUNTEER'];
  protected readonly stringifyRole = (r: RoleFilter | null): string =>
    r === 'PARTICIPANT' ? 'Jeunes' : r === 'VOLUNTEER' ? 'Bénévoles' : 'Tous les rôles';
  protected readonly expandedTransports = signal<ReadonlySet<number>>(new Set());

  // Selects Taiga UI : listes d'identifiants et libellés associés.
  protected readonly transportModes = ['CAR', 'TRAIN', 'VOITURES', 'AUTRE'];
  protected transportIds(): number[] {
    return this.repartition()?.transports.map((t) => t.id) ?? [];
  }
  protected stringifyTransportId = (id: number | null): string => {
    const t = this.repartition()?.transports.find((x) => x.id === id);
    return t ? `${t.name}${t.full ? ' (complet)' : ''}` : '';
  };
  protected transportIdFull = (id: number): boolean =>
    this.repartition()?.transports.find((x) => x.id === id)?.full ?? false;
  protected stringifyMode = (m: string | null): string =>
    (m ? (MODE_LABELS as Record<string, string>)[m] : '') ?? '';
  protected otherDelegationIds(): number[] {
    return this.groups()
      .filter((g) => g.id !== this.delegation()?.id)
      .map((g) => g.id);
  }
  protected stringifyDelegation = (id: number | null): string =>
    this.groups().find((g) => g.id === id)?.name ?? '';

  protected delegationId = 0;

  ngOnInit() {
    this.delegationId = Number(this.route.snapshot.paramMap.get('id'));
    forkJoin({
      groups: this.groupsApi.list(),
    }).subscribe({
      next: ({ groups }) => {
        this.groups.set(groups);
        this.delegation.set(groups.find((g) => g.id === this.delegationId) ?? null);
        this.api.persons(this.delegationId).subscribe({
          next: (members) => this.members.set(members),
          error: () => this.members.set([]),
        });
        this.reload();
      },
      error: () => {
        this.error.set('Impossible de charger les délégations.');
        this.loading.set(false);
      },
    });
  }

  protected setDirection(d: TransportDirection) {
    this.direction.set(d);
    this.selectedKeys.set(new Set());
    this.transportForm.set(this.emptyTransport());
    this.transportTimes.set(defaultTimes(d));
    this.editingTransportId.set(null);
    this.toAssignSearch.set('');
    this.toAssignShowAll.set(false);
    this.reload();
  }

  // File « à placer » : recherche et affichage borné (maquette écran 3).
  private readonly toAssignLimit = 8;
  protected filteredToAssign(): AssignmentEntry[] {
    const all = this.repartition()?.toAssign ?? [];
    const q = this.toAssignSearch().trim().toLowerCase();
    if (!q) return all;
    return all.filter((e) => this.personLabel(e.person).toLowerCase().includes(q));
  }
  protected visibleToAssign(): AssignmentEntry[] {
    const f = this.filteredToAssign();
    if (this.toAssignShowAll() || this.toAssignSearch().trim()) return f;
    return f.slice(0, this.toAssignLimit);
  }
  protected hiddenToAssignCount(): number {
    return Math.max(0, this.filteredToAssign().length - this.visibleToAssign().length);
  }

  // Occupants d'un trajet : affichage borné, dépliable.
  private readonly personsLimit = 8;
  protected visiblePersons(t: RepartitionTransport): AssignmentEntry[] {
    if (this.expandedTransports().has(t.id)) return t.persons;
    return t.persons.slice(0, this.personsLimit);
  }
  protected hiddenPersonsCount(t: RepartitionTransport): number {
    return Math.max(0, t.persons.length - this.visiblePersons(t).length);
  }
  protected toggleTransportExpanded(id: number) {
    this.expandedTransports.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  protected isTransportExpanded(id: number): boolean {
    return this.expandedTransports().has(id);
  }
  protected jaugePercent(t: RepartitionTransport): number {
    if (!t.capacity) return 0;
    return Math.min(100, Math.round((t.occupancy / t.capacity) * 100));
  }
  protected memberOptions(): SelectOption<string>[] {
    return this.members().map((m) => ({
      value: `${m.personType}:${m.id}`,
      label: this.personLabel(m),
    }));
  }

  protected reload() {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      repartition: this.api.repartition(this.delegationId, this.direction()),
      stats: this.api.stats(this.delegationId),
    }).subscribe({
      next: ({ repartition, stats }) => {
        this.repartition.set(repartition);
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          'Impossible de charger la répartition. Vérifiez vos droits sur cette délégation.',
        );
        this.loading.set(false);
      },
    });
  }

  protected statsFor(d: TransportDirection) {
    return this.stats()?.directions.find((x) => x.direction === d) ?? null;
  }

  protected personLabel(p: PersonLite | null): string {
    if (!p) return 'Personne introuvable';
    const kind = p.personType === 'VOLUNTEER' ? 'Bénévole' : 'Jeune';
    return `${p.firstName} ${p.lastName} · ${kind}${p.detail ? ' · ' + p.detail : ''}`;
  }

  protected entryKey(e: AssignmentEntry): string {
    return e.person ? `${e.person.personType}:${e.person.id}` : String(e.assignmentId);
  }

  // --------------------------------------------------------------- transports

  private emptyTransport(): TransportPayload {
    return {
      direction: this.direction(),
      transportMode: 'CAR',
      name: '',
      departureDatetime: null,
      arrivalDatetime: null,
      meetingPoint: null,
      practicalInfo: null,
      capacity: null,
      notes: null,
    };
  }

  protected editTransport(id: number) {
    const t = this.repartition()?.transports.find((x) => x.id === id);
    if (!t) return;
    this.editingTransportId.set(id);
    const fallback = DEFAULT_DATE_BY_DIRECTION[t.direction];
    const dep = splitIso(t.departureDatetime, fallback);
    const arr = splitIso(t.arrivalDatetime, fallback);
    this.transportTimes.set({ depDate: dep.date, depTime: dep.time, arrDate: arr.date, arrTime: arr.time });
    this.drawer.set('transport');
    this.transportForm.set({
      direction: t.direction,
      transportMode: t.transportMode,
      name: t.name,
      departureDatetime: null,
      arrivalDatetime: null,
      meetingPoint: t.meetingPoint,
      practicalInfo: t.practicalInfo,
      capacity: t.capacity,
      notes: t.notes,
    });
  }

  protected cancelTransportEdit() {
    this.editingTransportId.set(null);
    this.transportForm.set(this.emptyTransport());
    this.transportTimes.set(defaultTimes(this.direction()));
    this.drawer.set(null);
  }

  protected saveTransport() {
    const f = this.transportForm();
    const times = this.transportTimes();
    const payload: TransportPayload = {
      ...f,
      direction: this.direction(),
      departureDatetime: composeIso(times.depDate, times.depTime),
      arrivalDatetime: composeIso(times.arrDate, times.arrTime),
      capacity: f.capacity === null || (f.capacity as unknown as string) === '' ? null : Number(f.capacity),
    };
    const editing = this.editingTransportId();
    const request = editing
      ? this.api.updateTransport(editing, payload)
      : this.api.createTransport(this.delegationId, payload);
    request.subscribe({
      next: () => {
        this.cancelTransportEdit();
        this.reload();
      },
      error: () => this.error.set('La sous-délégation n’a pas pu être enregistrée.'),
    });
  }

  protected removeTransport(id: number) {
    this.confirmDialog
      .askDelete('cette sous-délégation', 'Les personnes placées retournent dans l’« à placer ».')
      .subscribe((ok) => {
        if (!ok) return;
        this.api.removeTransport(id).subscribe({
          next: () => this.reload(),
          error: () => this.error.set('La sous-délégation n’a pas pu être supprimée.'),
        });
      });
  }

  // ------------------------------------------------------------- affectations

  protected assignTo(entry: AssignmentEntry) {
    const key = this.entryKey(entry);
    const target = this.assignTargets()[key];
    if (!target || !entry.person) return;
    this.api.assign(target, entry.person.personType, entry.person.id).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('L’affectation n’a pas pu être enregistrée.'),
    });
  }

  protected unassign(entry: AssignmentEntry) {
    if (!entry.assignmentId) return;
    const assignmentId = entry.assignmentId;
    const isException = !!entry.person && entry.person.delegationId !== this.delegation()?.id;
    const name = entry.person ? this.personLabel(entry.person) : 'cette personne';
    this.confirmDialog
      .ask({
        title: `Retirer ${name} ?`,
        message: isException
          ? 'C’est une exception : elle sera supprimée et la personne retournera dans sa délégation d’origine.'
          : 'La personne retourne dans l’« à placer ».',
        yes: 'Retirer',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.unassign(assignmentId).subscribe({
          next: () => this.reload(),
          error: () => this.error.set('Le retrait n’a pas pu être enregistré.'),
        });
      });
  }

  protected setAssignTarget(key: string, value: number | null) {
    this.assignTargets.update((m) => ({ ...m, [key]: value }));
  }

  // --------------------------------------------------------------- exceptions

  protected createException() {
    const f = this.exceptionForm();
    const [personType, idStr] = f.personKey.split(':');
    const personId = Number(idStr);
    const toDelegationId = f.toDelegationId;
    if ((personType !== 'PARTICIPANT' && personType !== 'VOLUNTEER') || !personId || !toDelegationId)
      return;
    this.api
      .createException(this.delegationId, {
        personType,
        personId,
        direction: this.direction(),
        toDelegationId,
        note: f.note.trim() || undefined,
      })
      .subscribe({
        next: (created) => {
          const noteRefused = (created as { noteStatus?: string } | null)?.noteStatus === 'NOT_ALLOWED';
          // Note refusée : l'exception est bien créée, le texte saisi est conservé et rien n'annonce une note enregistrée.
          this.exceptionForm.set({
            personKey: '',
            toDelegationId: null,
            note: noteRefused ? f.note : '',
          });
          this.drawer.set(null);
          this.reload();
          if (noteRefused) {
            this.error.set(
              'L’exception est créée, mais votre note n’a pas été enregistrée : vous n’avez pas le droit d’écrire des notes. Le texte est conservé dans le formulaire d’exception.',
            );
          }
        },
        error: () => this.error.set('L’exception n’a pas pu être créée.'),
      });
  }

  // ------------------------------------------------- refonte : panneaux et sélection

  protected entryKeyOf = entryKeyOf;

  protected readonly openCards = signal<ReadonlySet<number>>(new Set());
  protected isCardOpen(id: number): boolean {
    return this.openCards().has(id);
  }
  protected toggleCard(id: number) {
    this.openCards.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  /** Complet à capacité atteinte ; « dépassée » seulement au-delà. */
  protected gaugeState(t: RepartitionTransport): 'none' | 'ok' | 'full' | 'over' {
    if (t.capacity === null) return 'none';
    if (t.occupancy > t.capacity) return 'over';
    return t.occupancy === t.capacity ? 'full' : 'ok';
  }
  protected delegationOptions(): SelectOption<string>[] {
    return this.otherDelegationIds().map((id) => ({
      value: String(id),
      label: this.stringifyDelegation(id),
    }));
  }

  protected openTransportDrawer() {
    this.editingTransportId.set(null);
    this.transportForm.set(this.emptyTransport());
    this.transportTimes.set(defaultTimes(this.direction()));
    this.drawer.set('transport');
  }

  protected openExceptionDrawer() {
    this.drawer.set('exception');
  }

  protected panelPeople(): AssignmentEntry[] {
    return filterPeople(this.repartition()?.toAssign ?? [], this.toAssignSearch(), this.roleFilter());
  }

  protected isSelected(e: AssignmentEntry): boolean {
    return this.selectedKeys().has(entryKeyOf(e));
  }

  protected toggleSelect(e: AssignmentEntry) {
    const key = entryKeyOf(e);
    this.selectedKeys.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected allVisibleSelected(): boolean {
    const visible = this.panelPeople();
    return visible.length > 0 && visible.every((e) => this.isSelected(e));
  }

  protected toggleAllVisible() {
    const visible = this.panelPeople();
    const all = this.allVisibleSelected();
    this.selectedKeys.update((set) => {
      const next = new Set(set);
      for (const e of visible) {
        if (all) next.delete(entryKeyOf(e));
        else next.add(entryKeyOf(e));
      }
      return next;
    });
  }

  protected selectionCount(): number {
    return this.selectedKeys().size;
  }

  protected onDragStart(event: DragEvent, e: AssignmentEntry) {
    const keys = dragPayload(this.selectedKeys(), e);
    this.selectedKeys.set(new Set(keys));
    event.dataTransfer?.setData('text/plain', keys.join(','));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected onDragOver(event: DragEvent, transportId: number) {
    event.preventDefault();
    this.dragOverId.set(transportId);
  }

  protected onDrop(event: DragEvent, transportId: number) {
    event.preventDefault();
    this.dragOverId.set(null);
    this.assignSelection(transportId);
  }

  /** Affecte la sélection à une sous-délégation, une personne après l'autre (pas de rafale de requêtes). */
  protected assignSelection(transportId: number | null) {
    if (!transportId || this.assigning()) return;
    const keys = this.selectedKeys();
    const people = (this.repartition()?.toAssign ?? []).filter((e) => e.person && keys.has(entryKeyOf(e)));
    if (!people.length) {
      this.error.set('Sélectionnez au moins une personne à placer.');
      return;
    }
    this.error.set('');
    this.assigning.set(true);
    concat(...people.map((e) => this.api.assign(transportId, e.person!.personType, e.person!.id)), of(null))
      .pipe(last())
      .subscribe({
        next: () => {
          this.assigning.set(false);
          this.selectedKeys.set(new Set());
          this.bulkTarget.set(null);
          this.reload();
        },
        error: () => {
          this.assigning.set(false);
          this.error.set('L’affectation n’a pas pu être enregistrée pour toute la sélection. Rechargement de l’état réel.');
          this.reload();
        },
      });
  }
}
