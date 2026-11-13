import { Component, OnInit, OnDestroy, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ExpectedGroupsApi,
  ManagedGroup,
  ManagedPassage,
  GroupSource,
  GroupMember,
  Page,
  SavePassage,
} from './expected-groups-api.service';
import { DetailReportApi, ConfigPoint } from './detail-report-api.service';
import { parisInstant, parisLocal } from './paris-datetime';
@Component({
  selector: 'app-expected-groups',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './expected-groups.page.html',
  styleUrl: './detail-report.page.scss',
})
export class ExpectedGroupsPage implements OnInit, OnDestroy {
  private api = inject(ExpectedGroupsApi);
  private configApi = inject(DetailReportApi);
  private requests: Subscription[] = [];
  private selectedRequest?: Subscription;
  private listRequest?: Subscription;
  private peopleRequest?: Subscription;
  private membersRequest?: Subscription;
  private passagesRequest?: Subscription;
  readonly groups = signal<Page<ManagedGroup>>({ items: [], total: 0 });
  readonly group = signal<ManagedGroup | null>(null);
  readonly members = signal<Page<GroupMember>>({ items: [], total: 0 });
  readonly passages = signal<Page<ManagedPassage>>({ items: [], total: 0 });
  readonly people = signal<Page<GroupMember>>({ items: [], total: 0 });
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly passageSaving = signal(false);
  readonly error = signal('');
  readonly passageError = signal('');
  readonly notice = signal('');
  readonly memberError = signal('');
  readonly listError = signal('');
  readonly peopleError = signal('');
  readonly dirty = signal(false);
  readonly passageDirty = signal(false);
  readonly membersVisible = signal(false);
  readonly editorOpen = signal(false);
  readonly listLoading = signal(false);
  readonly peopleLoading = signal(false);
  readonly membersLoading = signal(false);
  readonly passagesLoading = signal(false);
  selectedId: number | null = null;
  name = '';
  archived = false;
  sources: GroupSource[] = [];
  sourceLabels = new Map<string, string>();
  teams: { id: number; name: string }[] = [];
  points: ConfigPoint[] = [];
  types: { id: number; label: string }[] = [];
  groupSearch = '';
  groupOffset = 0;
  groupResultOffset = 0;
  memberOffset = 0;
  memberResultOffset = 0;
  passageOffset = 0;
  passageResultOffset = 0;
  peopleSearch = '';
  peopleOffset = 0;
  peopleResultOffset = 0;
  teamId: number | null = null;
  personType = '';
  passage: ManagedPassage | null = null;
  passagePointId: number | null = null;
  passageLabel = '';
  startsAt = '';
  endsAt = '';
  passageArchived = false;
  ngOnInit() {
    this.loadGroups();
    this.requests.push(
      forkJoin({
        teams: this.configApi.teams(),
        points: this.configApi.points(),
        types: this.configApi.types(),
      }).subscribe({
        next: (r) => Object.assign(this, r),
        error: () =>
          this.error.set(
            'Configuration équipes/points indisponible. Rechargez la page avant de modifier les sources ou les rattachements.',
          ),
      }),
    );
  }
  ngOnDestroy() {
    this.selectedRequest?.unsubscribe();
    this.listRequest?.unsubscribe();
    this.peopleRequest?.unsubscribe();
    this.membersRequest?.unsubscribe();
    this.passagesRequest?.unsubscribe();
    this.requests.forEach((s) => s.unsubscribe());
  }
  canDeactivate() {
    return this.saving() || this.passageSaving() ? false : this.canLeave();
  }
  @HostListener('window:beforeunload', ['$event']) warnBeforeUnload(event: BeforeUnloadEvent) {
    if (this.dirty() || this.passageDirty() || this.saving() || this.passageSaving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  private canLeave() {
    return (
      !(this.dirty() || this.passageDirty()) ||
      confirm('Abandonner les modifications non enregistrées du groupe ou du rattachement ?')
    );
  }
  loadGroups(reset = true) {
    if (reset) this.groupOffset = 0;
    this.listRequest?.unsubscribe();
    this.listLoading.set(true);
    this.listError.set('');
    const offset = this.groupOffset;
    this.listRequest = this.api.groups(this.groupSearch.trim(), offset).subscribe({
      next: (r) => {
        this.groups.set(r);
        this.groupResultOffset = offset;
        this.listLoading.set(false);
      },
      error: () => {
        this.listLoading.set(false);
        this.listError.set('Liste non actualisée. Réessayez.');
      },
    });
  }
  groupPage(n: number) {
    this.groupOffset = Math.max(0, this.groupOffset + n * 50);
    this.loadGroups(false);
  }
  choose(id: number | null) {
    if (this.saving() || this.passageSaving()) return;
    if (!this.canLeave()) {
      this.selectedId = this.group()?.id ?? null;
      return;
    }
    this.selectedId = id;
    this.dirty.set(false);
    this.passageDirty.set(false);
    this.notice.set('');
    this.error.set('');
    this.selectedRequest?.unsubscribe();
    this.membersRequest?.unsubscribe();
    this.passagesRequest?.unsubscribe();
    this.members.set({ items: [], total: 0 });
    this.passages.set({ items: [], total: 0 });
    this.membersVisible.set(false);
    this.editorOpen.set(false);
    this.group.set(null);
    this.name = '';
    this.archived = false;
    this.sources = [];
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.selectedRequest = this.api.group(id).subscribe({
      next: (g) => {
        this.group.set(g);
        this.name = g.name;
        this.archived = !!(g.archived_at ?? g.archivedAt);
        this.sources = g.sources.map((s) => ({ ...s }));
        this.loading.set(false);
        this.memberOffset = 0;
        this.passageOffset = 0;
        this.loadMembers();
        this.loadPassages();
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Groupe indisponible. Sélectionnez-le à nouveau.');
      },
    });
  }
  create() {
    this.choose(null);
  }
  edited() {
    this.dirty.set(true);
    this.notice.set('');
  }
  key(s: GroupSource) {
    return s.teamId
      ? 'team:' + s.teamId
      : s.personType
        ? 'type:' + s.personType
        : s.participantId
          ? 'participant:' + s.participantId
          : 'volunteer:' + s.volunteerId;
  }
  label(s: GroupSource) {
    if (s.label) return s.personType ? this.typeLabel(s.personType) : s.label;
    return s.teamId
      ? (this.teams.find((t) => t.id === s.teamId)?.name ?? `Équipe #${s.teamId}`)
      : s.personType
        ? this.typeLabel(s.personType)
        : (this.sourceLabels.get(this.key(s)) ??
          (s.participantId ? `Personne #${s.participantId}` : `Bénévole #${s.volunteerId}`));
  }
  typeLabel(type: string) {
    return (
      (
        { JEUNE: 'Jeunes', ANIMATEUR: 'Animateurs', BENEVOLE: 'Bénévoles' } as Record<
          string,
          string
        >
      )[type] ?? type
    );
  }
  add(s: GroupSource) {
    if (!this.sources.some((item) => this.key(item) === this.key(s))) {
      this.sources = [...this.sources, s];
      this.edited();
    }
  }
  addTeam() {
    if (this.teamId) this.add({ teamId: this.teamId });
  }
  addType() {
    if (this.personType) this.add({ personType: this.personType });
  }
  addPerson(p: GroupMember) {
    const s = p.volunteerId ? { volunteerId: p.volunteerId } : { participantId: p.participantId };
    this.sourceLabels.set(this.key(s), [p.firstName, p.lastName].filter(Boolean).join(' '));
    this.add(s);
  }
  remove(i: number) {
    this.sources = this.sources.filter((_, index) => index !== i);
    this.edited();
  }
  save() {
    if (this.saving() || this.loading() || this.passageSaving()) return;
    if (!this.name.trim()) {
      this.error.set('Nom du groupe requis.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const id = this.group()?.id ?? null;
    this.requests.push(
      this.api
        .save(id, {
          name: this.name.trim(),
          sources: this.sources.map((s) => ({
            ...(s.teamId ? { teamId: s.teamId } : {}),
            ...(s.personType ? { personType: s.personType } : {}),
            ...(s.participantId ? { participantId: s.participantId } : {}),
            ...(s.volunteerId ? { volunteerId: s.volunteerId } : {}),
          })),
          archived: this.archived,
          ...(id ? { version: this.group()?.version } : {}),
        })
        .subscribe({
          next: (g) => {
            this.saving.set(false);
            this.dirty.set(false);
            this.notice.set(
              'Groupe enregistré. Composition recalculée à partir des sources actuelles.',
            );
            this.selectedId = g.id;
            this.group.set({ ...g, sources: this.sources.map((s) => ({ ...s })) });
            this.memberOffset = 0;
            this.loadMembers();
            this.loadGroups();
            this.loadPassages();
          },
          error: (e) => {
            this.saving.set(false);
            this.error.set(
              e instanceof HttpErrorResponse && e.status === 409
                ? 'Le groupe a changé dans une autre session. Vos modifications sont conservées. Rechargez explicitement le groupe avant de réessayer.'
                : 'Enregistrement non confirmé. Vos modifications sont conservées. Rechargez le groupe pour vérifier son état avant de réessayer.',
            );
          },
        }),
    );
  }
  reload() {
    if (this.group()) this.choose(this.group()?.id ?? null);
  }
  loadMembers() {
    const id = this.group()?.id;
    if (!id) return;
    this.membersRequest?.unsubscribe();
    this.membersLoading.set(true);
    this.memberError.set('');
    const offset = this.memberOffset;
    this.membersRequest = this.api.members(id, offset).subscribe({
      next: (r) => {
        this.members.set(r);
        this.memberResultOffset = offset;
        this.membersLoading.set(false);
      },
      error: () => {
        this.membersLoading.set(false);
        this.memberError.set('Composition enregistrée non actualisée. Réessayez.');
      },
    });
  }
  memberPage(n: number) {
    this.memberOffset = Math.max(0, this.memberOffset + n * 50);
    this.loadMembers();
  }
  findPeople(reset = true) {
    if (reset) this.peopleOffset = 0;
    this.peopleRequest?.unsubscribe();
    this.peopleLoading.set(true);
    this.peopleError.set('');
    const offset = this.peopleOffset;
    this.peopleRequest = this.api.people(this.peopleSearch.trim(), offset).subscribe({
      next: (r) => {
        this.people.set(r);
        this.peopleResultOffset = offset;
        this.peopleLoading.set(false);
      },
      error: () => {
        this.peopleLoading.set(false);
        this.peopleError.set('Recherche indisponible. Réessayez.');
      },
    });
  }
  peoplePage(n: number) {
    this.peopleOffset = Math.max(0, this.peopleOffset + n * 50);
    this.findPeople(false);
  }
  loadPassages() {
    const id = this.group()?.id;
    if (!id) return;
    this.passagesRequest?.unsubscribe();
    this.passagesLoading.set(true);
    this.passageError.set('');
    const offset = this.passageOffset;
    this.passagesRequest = this.api.passages(id, offset).subscribe({
      next: (r) => {
        this.passages.set(r);
        this.passageResultOffset = offset;
        this.passagesLoading.set(false);
      },
      error: () => {
        this.passagesLoading.set(false);
        this.passageError.set('Rattachements non actualisés. Réessayez.');
      },
    });
  }
  passagePage(n: number) {
    this.passageOffset = Math.max(0, this.passageOffset + n * 50);
    this.loadPassages();
  }
  closePassage() {
    if (this.passageSaving()) return;
    if (this.passageDirty() && !confirm('Abandonner les modifications du rattachement ?')) return;
    this.editorOpen.set(false);
    this.passageDirty.set(false);
  }
  editPassage(p: ManagedPassage | null) {
    if (this.passageDirty() && !confirm('Abandonner les modifications du rattachement ?')) return;
    this.passageDirty.set(false);
    this.passage = p;
    this.passagePointId = p?.point_id ?? null;
    this.passageLabel = p?.label ?? '';
    this.startsAt = p ? parisLocal(p.starts_at) : '';
    this.endsAt = p ? parisLocal(p.ends_at) : '';
    this.passageArchived = !!p?.archived_at;
    this.passageError.set('');
    this.editorOpen.set(true);
  }
  selectedType() {
    return (
      this.types.find((t) => t.id === this.selectedPoint()?.scanTypeId)?.label ??
      this.selectedPoint()?.scanTypeId
    );
  }
  selectedPoint() {
    return this.points.find((p) => p.id === this.passagePointId);
  }
  savePassage() {
    const g = this.group(),
      point = this.selectedPoint();
    if (!g || this.passageSaving() || this.saving()) return;
    this.passageError.set('');
    if (this.dirty()) {
      this.passageError.set('Enregistrez la composition du groupe avant le rattachement.');
      return;
    }
    if (this.archived) {
      this.passageError.set('Réactivez et enregistrez le groupe avant le rattachement.');
      return;
    }
    if (!point?.active || !this.passageLabel.trim()) {
      this.passageError.set('Choisissez un point actif et un libellé.');
      return;
    }
    let dto: SavePassage;
    try {
      const start = parisInstant(this.startsAt),
        end = parisInstant(this.endsAt);
      if (
        Date.parse(end) <= Date.parse(start) ||
        Date.parse(end) - Date.parse(start) > 31 * 86400000
      )
        throw Error('Choisissez une période positive de 31 jours maximum.');
      dto = {
        groupId: g.id,
        pointId: point.id,
        scanTypeId: point.scanTypeId,
        ...(point.serviceKey ? { serviceKey: point.serviceKey } : {}),
        label: this.passageLabel.trim(),
        startsAt: start,
        endsAt: end,
        timezone: 'Europe/Paris',
        archived: this.passageArchived,
        ...(this.passage ? { version: this.passage.version } : {}),
      };
    } catch (e) {
      this.passageError.set((e as Error).message);
      return;
    }
    this.passageSaving.set(true);
    this.requests.push(
      this.api.savePassage(this.passage?.id ?? null, dto).subscribe({
        next: () => {
          this.passageSaving.set(false);
          this.editorOpen.set(false);
          this.passageDirty.set(false);
          this.notice.set(
            'Rattachement enregistré. Ce point impose désormais une connexion en ligne pour le contrôle des attendus.',
          );
          this.loadPassages();
        },
        error: (e) => {
          this.passageSaving.set(false);
          this.passageError.set(
            e instanceof HttpErrorResponse && e.status === 409
              ? 'Le rattachement a changé dans une autre session. Rechargez la liste et rouvrez-le. Votre formulaire est conservé.'
              : 'Enregistrement non confirmé. Rechargez la liste pour vérifier avant de réessayer. Votre formulaire est conservé.',
          );
        },
      }),
    );
  }
  time(instant: string) {
    return parisLocal(instant).replace('T', ' · ');
  }
}
