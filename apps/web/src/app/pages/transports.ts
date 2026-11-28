import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SHARED_IMPORTS } from '../shared/shared-imports';
import { ConfirmDialogService } from '../shared/confirm-dialog.service';
import { PersonPickerComponent, PersonSummary } from '../shared/person-picker.component';
import { SelectFieldComponent, SelectOption } from '../shared/select-field.component';
import { ALLEGRIA_2027_EVENT_DATES } from '../shared/event-date-selector/event-date.config';
import {
  CarPayload,
  GatheringCar,
  GatheringCarPersonKind,
  GatheringTransportsBoard,
  FamilyChoice,
  ServeTarget,
  StopPayload,
  TransportsApiService,
} from './transports-api.service';
import {
  dragPayload,
  filterTargets,
  gaugeState,
  jaugePercent,
  selectionPersonCount,
  serviceDatesSummary,
  stopsSummary,
  targetKey,
} from './transports-board.logic';

/** Jours de circulation proposés : les 4 jours du rassemblement (config partagée). */
function gatheringDays(): { value: string; label: string }[] {
  const days: { value: string; label: string }[] = [];
  const start = new Date(`${ALLEGRIA_2027_EVENT_DATES.startDate}T00:00:00`);
  const end = new Date(`${ALLEGRIA_2027_EVENT_DATES.endDate}T00:00:00`);
  const fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  for (let d = new Date(start), i = 1; d <= end; d.setDate(d.getDate() + 1), i += 1) {
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ value, label: `J${i} · ${fmt.format(d)}` });
  }
  return days;
}

/**
 * Transports du rassemblement : affectation des groupes d'hébergement et des
 * hébergements collectifs aux cars (deux panneaux, sélection puis affectation,
 * glisser-déposer et boutons, deux étapes sur mobile). Les trajets aller/retour
 * des délégations restent gérés dans la fiche de chaque délégation.
 */
@Component({
  selector: 'app-transports',
  standalone: true,
  imports: [...SHARED_IMPORTS, RouterLink, SelectFieldComponent, PersonPickerComponent],
  templateUrl: './transports.html',
  styleUrls: ['../shared/crud.scss', './transports.scss'],
})
export class Transports implements OnInit {
  private readonly api = inject(TransportsApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly board = signal<GatheringTransportsBoard | null>(null);

  // Panneaux, sélection et glisser-déposer (composants repris de la répartition des délégations).
  protected readonly step = signal<'cibles' | 'cars'>('cibles');
  protected readonly search = signal('');
  protected readonly selectedKeys = signal<ReadonlySet<string>>(new Set());
  protected readonly targetCarId = signal<number | null>(null);
  protected readonly dragOverId = signal<number | null>(null);
  protected readonly assigning = signal(false);

  // Tiroirs : car (création/modification), arrêts, exception individuelle.
  protected readonly drawer = signal<'car' | 'stops' | 'person' | null>(null);
  protected readonly editingCarId = signal<number | null>(null);
  protected readonly carForm = signal<{ name: string; capacity: number | null; serviceDates: string[]; notes: string }>({
    name: '',
    capacity: null,
    serviceDates: [],
    notes: '',
  });
  protected readonly stopsForm = signal<StopPayload[]>([]);
  protected readonly personForm = signal<{ kind: GatheringCarPersonKind; person: PersonSummary | null }>({
    kind: 'ADDED',
    person: null,
  });
  protected readonly openCards = signal<ReadonlySet<number>>(new Set());

  protected readonly dayOptions = gatheringDays();
  protected readonly kindOptions: SelectOption<GatheringCarPersonKind>[] = [
    { value: 'ADDED', label: 'Part avec ce car (son lieu n\'est pas desservi par lui)' },
    { value: 'REMOVED', label: 'Ne part pas avec ce car (alors que son lieu est desservi par lui)' },
  ];
  protected readonly gaugeState = gaugeState;
  protected readonly jaugePercent = jaugePercent;
  protected readonly stopsSummary = stopsSummary;
  protected readonly serviceDatesSummary = serviceDatesSummary;
  protected readonly targetKey = targetKey;

  ngOnInit() {
    this.reload();
  }

  protected reload(keepError = false) {
    this.loading.set(true);
    if (!keepError) this.error.set('');
    this.api.board().subscribe({
      next: (board) => {
        this.board.set(board);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les transports du rassemblement. Vérifiez vos droits Transports.');
        this.loading.set(false);
      },
    });
  }

  // ------------------------------------------------------------------ panneau

  protected panelTargets(): ServeTarget[] {
    return filterTargets(this.board()?.targets ?? [], this.search());
  }
  protected readonly showUndecided = signal(false);
  protected undecidedCount(): number {
    return this.board()?.undecidedTargets?.length ?? 0;
  }
  /** Marque le besoin de transport d'une cible (true = nécessaire, false = pas besoin, null = non renseigné). */
  protected setNeed(t: Pick<ServeTarget, 'targetType' | 'id'>, needsTransport: boolean | null) {
    this.error.set('');
    this.api.setNeed(t, needsTransport).subscribe({
      next: () => this.reload(),
      error: () => {
        this.error.set('Le besoin de transport n\'a pas pu être enregistré. Rechargement de l\'état réel.');
        this.reload();
      },
    });
  }
  protected readonly showFamilies = signal(false);
  protected familyChoices(): FamilyChoice[] {
    return this.board()?.familyChoices ?? [];
  }
  /** Besoin propre d'une famille d'un groupe : null = elle suit le groupe. */
  protected setFamilyNeed(f: FamilyChoice, needsTransport: boolean | null) {
    this.setNeed({ targetType: 'HOST_FAMILY', id: f.id }, needsTransport);
  }
  protected servedCount(): number {
    return (this.board()?.targets ?? []).filter((t) => t.carId !== null).length;
  }
  protected isSelected(t: ServeTarget): boolean {
    return this.selectedKeys().has(t.key);
  }
  protected toggleSelect(t: ServeTarget) {
    this.selectedKeys.update((set) => {
      const next = new Set(set);
      if (next.has(t.key)) next.delete(t.key);
      else next.add(t.key);
      return next;
    });
  }
  protected allVisibleSelected(): boolean {
    const visible = this.panelTargets();
    return visible.length > 0 && visible.every((t) => this.isSelected(t));
  }
  protected toggleAllVisible() {
    const visible = this.panelTargets();
    const all = this.allVisibleSelected();
    this.selectedKeys.update((set) => {
      const next = new Set(set);
      for (const t of visible) {
        if (all) next.delete(t.key);
        else next.add(t.key);
      }
      return next;
    });
  }
  protected selectionCount(): number {
    return this.selectedKeys().size;
  }
  protected selectionPersons(): number {
    return selectionPersonCount(this.board()?.targets ?? [], this.selectedKeys());
  }

  protected carOptions(): SelectOption<number>[] {
    return (this.board()?.cars ?? []).map((c) => ({ value: c.id, label: c.name }));
  }

  // ------------------------------------------------------------------ actions

  protected onDragStart(event: DragEvent, t: ServeTarget) {
    const keys = dragPayload(this.selectedKeys(), t);
    this.selectedKeys.set(new Set(keys));
    event.dataTransfer?.setData('text/plain', keys.join(','));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }
  protected onDragOver(event: DragEvent, carId: number) {
    event.preventDefault();
    this.dragOverId.set(carId);
  }
  protected onDrop(event: DragEvent, carId: number) {
    event.preventDefault();
    this.dragOverId.set(null);
    this.assignSelection(carId);
  }

  /** Affecte la sélection à un car (les cibles déjà desservies ailleurs sont déplacées). */
  protected assignSelection(carId: number | null) {
    if (!carId || this.assigning()) return;
    const keys = this.selectedKeys();
    const targets = (this.board()?.targets ?? []).filter((t) => keys.has(t.key));
    if (!targets.length) {
      this.error.set('Sélectionnez au moins un groupe ou lieu à desservir.');
      return;
    }
    this.error.set('');
    const moved = targets.filter((t) => t.carId != null && t.carId !== carId);
    if (!moved.length) {
      this.sendAssign(carId, targets, false);
      return;
    }
    const carName = this.board()?.cars.find((c) => c.id === carId)?.name ?? 'ce car';
    this.confirmDialog
      .ask({
        title: 'Déplacer vers un autre car ?',
        message: `${moved.map((t) => `${t.name} (actuellement ${t.carName ?? 'un autre car'})`).join(', ')} : déplacer vers « ${carName} » ?`,
        yes: 'Déplacer',
      })
      .subscribe((ok) => {
        if (ok) this.sendAssign(carId, targets, true);
      });
  }

  private sendAssign(carId: number, targets: ServeTarget[], confirmMove: boolean) {
    this.assigning.set(true);
    this.api
      .assign(
        carId,
        targets.map((t) => ({ targetType: t.targetType, id: t.id })),
        confirmMove,
      )
      .subscribe({
        next: () => {
          this.assigning.set(false);
          this.selectedKeys.set(new Set());
          this.targetCarId.set(null);
          this.reload();
        },
        error: (err) => {
          this.assigning.set(false);
          const msg = err?.error?.message;
          this.error.set(
            err?.status === 400 && typeof msg === 'string'
              ? msg
              : 'L\'affectation n\'a pas pu être enregistrée. Rechargement de l\'état réel.',
          );
          this.reload(true);
        },
      });
  }

  protected unassign(a: { id: number; name: string }) {
    this.confirmDialog
      .ask({
        title: `Retirer ${a.name} ?`,
        message: 'Le groupe ou le lieu retourne dans « à desservir » ; les exceptions individuelles du car sont conservées.',
        yes: 'Retirer',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.unassign(a.id).subscribe({
          next: () => this.reload(),
          error: () => this.error.set('Le retrait n\'a pas pu être enregistré.'),
        });
      });
  }

  // --------------------------------------------------------------------- cars

  protected openCarDrawer(car: GatheringCar | null) {
    this.editingCarId.set(car?.id ?? null);
    this.carForm.set({
      name: car?.name ?? '',
      capacity: car?.capacity ?? null,
      serviceDates: car?.serviceDates ?? [],
      notes: car?.notes ?? '',
    });
    this.drawer.set('car');
  }
  protected toggleDay(value: string) {
    this.carForm.update((f) => ({
      ...f,
      serviceDates: f.serviceDates.includes(value)
        ? f.serviceDates.filter((d) => d !== value)
        : [...f.serviceDates, value].sort(),
    }));
  }
  protected saveCar() {
    const f = this.carForm();
    const payload: CarPayload = {
      name: f.name.trim(),
      capacity: f.capacity,
      serviceDates: f.serviceDates.length ? f.serviceDates : null,
      notes: f.notes.trim() || null,
    };
    if (!payload.name) return;
    const editing = this.editingCarId();
    const request = editing ? this.api.updateCar(editing, payload) : this.api.createCar(payload);
    request.subscribe({
      next: () => {
        this.drawer.set(null);
        this.reload();
      },
      error: () => this.error.set('Le car n\'a pas pu être enregistré.'),
    });
  }
  protected removeCar(car: GatheringCar) {
    this.confirmDialog
      .askDelete(`le car ${car.name}`, 'Ses arrêts et exceptions sont supprimés ; les cibles desservies retournent dans « à desservir ».')
      .subscribe((ok) => {
        if (!ok) return;
        this.api.removeCar(car.id).subscribe({
          next: () => this.reload(),
          error: () => this.error.set('Le car n\'a pas pu être supprimé.'),
        });
      });
  }

  // -------------------------------------------------------------------- arrêts

  protected openStopsDrawer(car: GatheringCar) {
    this.editingCarId.set(car.id);
    this.stopsForm.set(car.stops.map((s) => ({ label: s.label, time: s.time })));
    this.drawer.set('stops');
  }
  protected addStop() {
    this.stopsForm.update((stops) => [...stops, { label: '', time: null }]);
  }
  protected removeStop(index: number) {
    this.stopsForm.update((stops) => stops.filter((_, i) => i !== index));
  }
  protected moveStop(index: number, delta: number) {
    this.stopsForm.update((stops) => {
      const next = [...stops];
      const target = index + delta;
      if (target < 0 || target >= next.length) return stops;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  protected updateStop(index: number, patch: Partial<StopPayload>) {
    this.stopsForm.update((stops) => stops.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  protected saveStops() {
    const carId = this.editingCarId();
    if (!carId) return;
    const stops = this.stopsForm().filter((s) => s.label.trim());
    this.api.setStops(carId, stops.map((s) => ({ label: s.label.trim(), time: s.time || null }))).subscribe({
      next: () => {
        this.drawer.set(null);
        this.reload();
      },
      error: () => this.error.set('Les arrêts n\'ont pas pu être enregistrés.'),
    });
  }

  // ------------------------------------------------------------------ personnes

  protected openPersonDrawer(car: GatheringCar) {
    this.editingCarId.set(car.id);
    this.personForm.set({ kind: 'ADDED', person: null });
    this.drawer.set('person');
  }
  protected savePerson() {
    const carId = this.editingCarId();
    const f = this.personForm();
    if (!carId || !f.person) return;
    this.api.addPerson(carId, f.person.id, f.kind).subscribe({
      next: () => {
        this.drawer.set(null);
        this.reload();
      },
      error: () =>
        this.error.set(
          f.kind === 'REMOVED'
            ? 'Retrait impossible : cette personne n\'est hébergée dans aucun lieu desservi par ce car.'
            : 'L\'ajout n\'a pas pu être enregistré.',
        ),
    });
  }
  protected removePerson(rowId: number) {
    this.api.removePerson(rowId).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('L\'exception n\'a pas pu être supprimée.'),
    });
  }

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
}
