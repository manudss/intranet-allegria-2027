import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Group } from '../../models/models';
import { GroupsApiService } from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import {
  AssignmentEntry,
  DelegationStats,
  DelegationsApiService,
  PersonLite,
  PersonType,
  Repartition,
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
 * Fiche délégation côté transports : trajets aller/retour, répartition des
 * personnes (à placer, placées, exceptions) et création d'exceptions.
 * Le périmètre est appliqué côté serveur : un responsable ne voit que sa
 * délégation, sans jamais exposer de données de santé.
 */
@Component({
  selector: 'app-delegation-detail',
  standalone: true,
  imports: [...SHARED_IMPORTS, RouterLink],
  templateUrl: './delegation-detail.html',
  styleUrl: '../../shared/crud.scss',
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
  protected readonly editingTransportId = signal<number | null>(null);
  protected readonly exceptionForm = signal({
    personType: 'PARTICIPANT' as PersonType,
    personId: '',
    toDelegationId: '',
  });
  protected readonly assignTargets = signal<Record<string, string>>({});

  private delegationId = 0;

  ngOnInit() {
    this.delegationId = Number(this.route.snapshot.paramMap.get('id'));
    forkJoin({
      groups: this.groupsApi.list(),
    }).subscribe({
      next: ({ groups }) => {
        this.groups.set(groups);
        this.delegation.set(groups.find((g) => g.id === this.delegationId) ?? null);
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
    this.transportForm.set(this.emptyTransport());
    this.editingTransportId.set(null);
    this.reload();
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
    this.transportForm.set({
      direction: t.direction,
      transportMode: t.transportMode,
      name: t.name,
      departureDatetime: t.departureDatetime ? t.departureDatetime.slice(0, 16) : null,
      arrivalDatetime: t.arrivalDatetime ? t.arrivalDatetime.slice(0, 16) : null,
      meetingPoint: t.meetingPoint,
      practicalInfo: t.practicalInfo,
      capacity: t.capacity,
      notes: t.notes,
    });
  }

  protected cancelTransportEdit() {
    this.editingTransportId.set(null);
    this.transportForm.set(this.emptyTransport());
  }

  protected saveTransport() {
    const f = this.transportForm();
    const payload: TransportPayload = {
      ...f,
      direction: this.direction(),
      departureDatetime: f.departureDatetime ? new Date(f.departureDatetime).toISOString() : null,
      arrivalDatetime: f.arrivalDatetime ? new Date(f.arrivalDatetime).toISOString() : null,
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
      error: () => this.error.set('Le trajet n’a pas pu être enregistré.'),
    });
  }

  protected removeTransport(id: number) {
    this.confirmDialog
      .askDelete('ce trajet', 'Les personnes placées retournent dans l’« à placer ».')
      .subscribe((ok) => {
        if (!ok) return;
        this.api.removeTransport(id).subscribe({
          next: () => this.reload(),
          error: () => this.error.set('Le trajet n’a pas pu être supprimé.'),
        });
      });
  }

  // ------------------------------------------------------------- affectations

  protected assignTo(entry: AssignmentEntry) {
    const key = this.entryKey(entry);
    const target = Number(this.assignTargets()[key]);
    if (!target || !entry.person) return;
    this.api.assign(target, entry.person.personType, entry.person.id).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('L’affectation n’a pas pu être enregistrée.'),
    });
  }

  protected unassign(entry: AssignmentEntry) {
    if (!entry.assignmentId) return;
    this.api.unassign(entry.assignmentId).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Le retrait n’a pas pu être enregistré.'),
    });
  }

  protected setAssignTarget(key: string, value: string) {
    this.assignTargets.update((m) => ({ ...m, [key]: value }));
  }

  // --------------------------------------------------------------- exceptions

  protected createException() {
    const f = this.exceptionForm();
    const personId = Number(f.personId);
    const toDelegationId = Number(f.toDelegationId);
    if (!personId || !toDelegationId) return;
    this.api
      .createException(this.delegationId, {
        personType: f.personType,
        personId,
        direction: this.direction(),
        toDelegationId,
      })
      .subscribe({
        next: () => {
          this.exceptionForm.set({ personType: 'PARTICIPANT', personId: '', toDelegationId: '' });
          this.reload();
        },
        error: () => this.error.set('L’exception n’a pas pu être créée.'),
      });
  }
}
