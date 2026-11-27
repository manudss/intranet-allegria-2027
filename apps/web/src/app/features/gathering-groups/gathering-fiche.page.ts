import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, forkJoin, switchMap, takeUntil } from 'rxjs';
import { MyAccessService } from '../../core/my-access.service';
import { VolunteerTeamsApiService } from '../../services/api.services';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { PersonPickerComponent, PersonSummary, personLabel } from '../../shared/person-picker.component';
import { SelectFieldComponent, SelectOption } from '../../shared/select-field.component';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { GatheringGroupsApiService } from './gathering-groups.api';
import {
  CATEGORY_LABELS,
  GatheringSequenceRef,
  GATHERING_CATEGORIES,
  GatheringCategory,
  GatheringFiche,
  TRACK_COLORS,
  TRACK_LABELS,
} from './gathering-groups.models';

type Notice = { kind: 'error' | 'info'; text: string };

/**
 * Fiche d'un groupe de rassemblement : composition, personnes (prénoms seulement),
 * équipes bénévoles opérationnelles rattachées et responsables (périmètre).
 */
@Component({
  selector: 'app-gathering-fiche',
  standalone: true,
  imports: [...SHARED_IMPORTS, SelectFieldComponent, PersonPickerComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gathering-fiche.page.html',
  styleUrl: './gathering-fiche.page.scss',
})
export class GatheringFichePage implements OnInit, OnDestroy {
  private readonly api = inject(GatheringGroupsApiService);
  private readonly volunteerTeamsApi = inject(VolunteerTeamsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroy$ = new Subject<void>();

  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly trackColors = TRACK_COLORS;
  protected readonly trackLabels = TRACK_LABELS;
  private readonly myAccess = inject(MyAccessService);
  protected readonly canOpenTeams = () => this.myAccess.can('GATHERING_TEAMS', 'VIEW');
  protected readonly canEditTeams = () => this.myAccess.can('GATHERING_TEAMS', 'EDIT');
  protected readonly canOpenPeople = () => this.myAccess.can('PARTICIPANTS', 'VIEW');
  protected readonly canEditPeople = () => this.myAccess.can('PARTICIPANTS', 'EDIT');
  protected readonly canOpenAgenda = () => this.myAccess.can('AGENDA', 'VIEW');
  protected readonly canEditGroups = () => this.myAccess.can('GATHERING_GROUPS', 'EDIT');
  protected readonly categoryOptions: SelectOption<GatheringCategory>[] = GATHERING_CATEGORIES.map(
    (c) => ({ value: c, label: CATEGORY_LABELS[c] }),
  );

  protected readonly groupId = signal(0);
  protected readonly fiche = signal<GatheringFiche | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<Notice | null>(null);

  // Édition des informations du groupe
  protected readonly editing = signal(false);
  protected readonly editName = signal('');
  protected readonly editCategory = signal<GatheringCategory | null>('MIXTE');
  protected readonly editCapacity = signal('');
  protected readonly editLocation = signal('');
  protected readonly editNotes = signal('');

  // Équipes bénévoles opérationnelles
  protected readonly volunteerTeamOptions = signal<SelectOption<number>[]>([]);
  protected readonly volunteerTeamToAdd = signal<number | null>(null);

  // Créneaux de l'agenda liés (plusieurs-à-plusieurs, ajout et retrait indépendants)
  protected readonly allSequences = signal<GatheringSequenceRef[]>([]);
  protected readonly sequenceSearch = signal('');
  /** Alertes du groupe regroupées par type : compactes, détail déroulable, rien de masqué. */
  protected readonly alertGroups = computed(() => {
    const f = this.fiche();
    if (!f) return [];
    const defs: { key: string; kind: string; label: string; severe: boolean; text: (a: any) => string }[] = [
      { key: 'o', kind: 'OVERFLOW', label: 'dépassement de capacité', severe: true, text: (a) => a.message },
      { key: 'f', kind: 'FULL', label: 'groupe complet', severe: false, text: (a) => a.message },
      { key: 'a', kind: 'ALMOST_FULL', label: 'groupe presque complet', severe: false, text: (a) => a.message },
      { key: 't', kind: 'TEAM_WITHOUT_TRACK', label: 'équipe(s) sans piste (TA ou ES)', severe: false, text: (a) => a.teamName },
      {
        key: 's',
        kind: 'SEQUENCE_OVERLAP',
        label: 'chevauchement(s) d\'horaire avec un autre groupe',
        severe: false,
        text: (a) => `${a.teamName} : « ${a.sequenceTitle} » chevauche « ${a.otherSequenceTitle} » (groupe « ${a.otherGroupName} »)`,
      },
    ];
    return defs
      .map((d) => ({ key: d.key, label: d.label, severe: d.severe, items: f.alerts.filter((a) => a.kind === d.kind).map(d.text) }))
      .filter((g) => g.items.length);
  });
  protected readonly addingSequence = signal(false);
  private sequencesLoaded = false;

  /** Charge les créneaux proposables à la demande (lecture réservée aux comptes ayant accès à l'agenda). */
  protected openAddSequence(): void {
    this.addingSequence.set(true);
    if (this.sequencesLoaded) return;
    this.sequencesLoaded = true;
    this.api.sequenceOptions().subscribe({
      next: (list) => this.allSequences.set(list),
      error: () => (this.sequencesLoaded = false),
    });
  }
  protected readonly linkedSequenceIds = computed(
    () => new Set((this.fiche()?.sequences ?? []).map((q) => q.id)),
  );
  protected readonly addableSequences = computed(() => {
    const q = this.sequenceSearch().trim().toLowerCase();
    return this.allSequences()
      .filter((x) => !this.linkedSequenceIds().has(x.id))
      .filter((x) => !q || `${x.title} ${x.eventDate} ${x.startTime} ${x.location ?? ''}`.toLowerCase().includes(q))
      .slice(0, 30);
  });

  // Responsables
  protected readonly managerToAdd = signal<PersonSummary | null>(null);

  protected readonly attachedVolunteerTeamIds = computed(
    () => new Set((this.fiche()?.volunteerTeams ?? []).map((v) => v.id)),
  );
  protected readonly addableVolunteerTeams = computed(() =>
    this.volunteerTeamOptions().filter((o) => !this.attachedVolunteerTeamIds().has(o.value)),
  );
  protected readonly personLabel = personLabel;

  ngOnInit(): void {
    this.myAccess.load();
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.groupId.set(Number(params.get('id')) || 0);
          this.loading.set(true);
          return forkJoin([this.api.fiche(this.groupId()), this.volunteerTeamsApi.list()]);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: ([fiche, volunteerTeams]) => {
          this.fiche.set(fiche);
          this.volunteerTeamOptions.set(
            volunteerTeams.map((v) => ({ value: v.id, label: v.name })),
          );
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notice.set({ kind: 'error', text: 'Impossible de charger la fiche.' });
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected reload(): void {
    this.api.fiche(this.groupId()).subscribe({
      next: (fiche) => this.fiche.set(fiche),
      error: () => this.notice.set({ kind: 'error', text: 'Rechargement impossible.' }),
    });
  }

  protected linkSequence(sequenceId: number): void {
    this.api.linkSequence(this.groupId(), sequenceId).subscribe({
      next: () => this.reload(),
      error: (err) => this.notice.set({ kind: 'error', text: this.readError(err, 'Lien impossible.') }),
    });
  }

  protected unlinkSequence(sequence: GatheringSequenceRef): void {
    this.confirmDialog
      .ask({
        title: 'Retirer le créneau',
        message: `Retirer le lien avec « ${sequence.title} » (${sequence.eventDate} ${sequence.startTime}) ? Les autres créneaux et groupes ne changent pas.`,
        yes: 'Retirer',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.unlinkSequence(this.groupId(), sequence.id).subscribe({
          next: () => this.reload(),
          error: (err) => this.notice.set({ kind: 'error', text: this.readError(err, 'Retrait impossible.') }),
        });
      });
  }

  protected startEdit(): void {
    const f = this.fiche();
    if (!f) return;
    this.editName.set(f.name);
    this.editCategory.set(f.category);
    this.editCapacity.set(f.capacity == null ? '' : String(f.capacity));
    this.editLocation.set(f.location ?? '');
    this.editNotes.set(f.notes ?? '');
    this.editing.set(true);
  }

  protected saveEdit(): void {
    if (!this.editName().trim() || this.busy()) return;
    const capacityRaw = this.editCapacity().trim();
    const capacity = capacityRaw === '' ? null : Number(capacityRaw);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
      this.notice.set({ kind: 'error', text: 'Capacité invalide : un nombre entier positif, ou vide.' });
      return;
    }
    this.busy.set(true);
    this.api
      .updateGroup(this.groupId(), {
        name: this.editName().trim(),
        category: this.editCategory() ?? 'MIXTE',
        capacityPersons: capacity,
        location: this.editLocation().trim() || null,
        notes: this.editNotes().trim() || null,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.editing.set(false);
          this.notice.set({ kind: 'info', text: 'Fiche mise à jour.' });
          this.reload();
        },
        error: (err) => {
          this.busy.set(false);
          this.notice.set({ kind: 'error', text: this.readError(err, 'Enregistrement impossible.') });
        },
      });
  }

  protected attachVolunteerTeam(): void {
    const id = this.volunteerTeamToAdd();
    if (!id || this.busy()) return;
    this.busy.set(true);
    this.api.attachVolunteerTeam(this.groupId(), id).subscribe({
      next: () => {
        this.busy.set(false);
        this.volunteerTeamToAdd.set(null);
        this.reload();
      },
      error: (err) => {
        this.busy.set(false);
        this.notice.set({ kind: 'error', text: this.readError(err, 'Rattachement impossible.') });
      },
    });
  }

  protected detachVolunteerTeam(volunteerTeamId: number, name: string): void {
    this.confirmDialog
      .ask({
        title: 'Retirer l\'équipe opérationnelle',
        message: `Détacher « ${name} » de ce groupe ?`,
        yes: 'Retirer',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.detachVolunteerTeam(this.groupId(), volunteerTeamId).subscribe({
          next: () => this.reload(),
          error: (err) =>
            this.notice.set({ kind: 'error', text: this.readError(err, 'Retrait impossible.') }),
        });
      });
  }

  protected addManager(): void {
    const person = this.managerToAdd();
    const f = this.fiche();
    if (!person || !f || this.busy()) return;
    const ids = [...f.managers.map((m) => m.userId), person.id];
    this.saveManagers(ids, `« ${personLabel(person)} » est maintenant responsable du groupe.`);
    this.managerToAdd.set(null);
  }

  protected removeManager(userId: number): void {
    const f = this.fiche();
    if (!f) return;
    this.saveManagers(
      f.managers.map((m) => m.userId).filter((id) => id !== userId),
      'Responsable retiré.',
    );
  }

  private saveManagers(userIds: number[], successText: string): void {
    this.busy.set(true);
    this.api.setManagers(this.groupId(), userIds).subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set({ kind: 'info', text: successText });
        this.reload();
      },
      error: (err) => {
        this.busy.set(false);
        this.notice.set({ kind: 'error', text: this.readError(err, 'Nomination impossible.') });
      },
    });
  }

  protected gaugeRatio(): number {
    const f = this.fiche();
    if (!f?.capacity) return 0;
    return Math.min(1, f.persons / f.capacity);
  }

  private readError(err: unknown, fallback: string): string {
    const message = (err as { error?: { message?: string | string[] } })?.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || fallback;
  }
}
