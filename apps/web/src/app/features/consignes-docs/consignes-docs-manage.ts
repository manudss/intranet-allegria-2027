import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import {
  DocumentCategory,
  DocumentFileType,
  DocumentLink,
  DocumentLinkPayload,
  DocumentVisibility,
  VolunteerTeam,
} from '../../models/models';
import {
  DocumentCategoriesApiService,
  DocumentLinksApiService,
  VolunteerTeamsApiService,
} from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SelectFieldComponent, SelectOption } from '../../shared/select-field.component';
import { TuiCheckbox } from '@taiga-ui/core';
import { TuiChip } from '@taiga-ui/kit';
import { DataTableColumn } from '../../shared/data-table';

const FILE_TYPES: readonly DocumentFileType[] = ['PDF', 'DOCX', 'XLSX', 'PPTX', 'OTHER'];

const NO_CATEGORY = 0;
type TeamStatusFilter = 'all' | 'active' | 'inactive' | 'selected';

const blank = (): DocumentLinkPayload => ({
  title: '',
  description: '',
  url: '',
  fileType: 'PDF',
  categoryId: null,
  visibility: 'ALL',
  teamIds: [],
});

@Component({
  selector: 'app-consignes-docs-manage',
  standalone: true,
  imports: [...SHARED_IMPORTS, SelectFieldComponent, TuiCheckbox, TuiChip],
  templateUrl: './consignes-docs-manage.html',
  styleUrls: ['../../shared/crud.scss', './consignes-docs-manage.scss'],
})
export class ConsignesDocsManagePage implements OnInit {
  protected readonly fileTypes = FILE_TYPES;
  protected readonly audienceOptions: readonly SelectOption<DocumentVisibility>[] = [
    { value: 'ALL', label: 'Tous les utilisateurs connectés' },
    { value: 'TEAMS', label: 'Certaines équipes opérationnelles' },
  ];
  protected readonly fileTypeOptions: readonly SelectOption<DocumentFileType>[] = FILE_TYPES.map(
    (type) => ({ value: type, label: type }),
  );

  protected readonly tableColumns: readonly DataTableColumn<DocumentLink>[] = [
    {
      key: 'title',
      label: 'Titre',
      type: 'text',
      value: (link) => link.title,
      presentation: { type: 'icon', icon: () => '@tui.file-text' },
      size: 'large',
    },
    {
      key: 'category',
      label: 'Catégorie',
      type: 'list',
      value: (link) => link.category?.label ?? '—',
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.tag' },
      size: 'small',
    },
    {
      key: 'fileType',
      label: 'Type',
      type: 'list',
      value: (link) => link.fileType,
      presentation: { type: 'chip', autoColor: true },
      size: 'xsmall',
    },
    {
      key: 'visibility',
      label: 'Audience',
      type: 'list',
      value: (link) => (link.visibility === 'ALL' ? 'Tous' : 'Équipes'),
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.users' },
      size: 'small',
    },
    {
      key: 'teams',
      label: 'Équipes',
      type: 'text',
      value: (link) => (link.teams.length ? link.teams.map((team) => team.name).join(', ') : '—'),
      hidden: true,
      presentation: {
        type: 'chips',
        autoColor: true,
        values: (link) => link.teams.map((team) => team.name),
      },
      size: 'xlarge',
    },
  ];

  private readonly linksApi = inject(DocumentLinksApiService);
  private readonly categoriesApi = inject(DocumentCategoriesApiService);
  private readonly teamsApi = inject(VolunteerTeamsApiService);
  private readonly auth = inject(AuthService);

  readonly canWrite = computed(() => this.auth.hasAnyRole(['ADMIN', 'COORDINATOR']));

  items = signal<DocumentLink[]>([]);
  categories = signal<DocumentCategory[]>([]);
  teams = signal<VolunteerTeam[]>([]);
  query = signal('');
  teamSearch = signal('');
  teamStatusFilter = signal<TeamStatusFilter>('all');
  protected readonly teamStatusFilters: readonly { id: TeamStatusFilter; label: string }[] = [
    { id: 'all', label: 'Toutes' },
    { id: 'active', label: 'Actives' },
    { id: 'inactive', label: 'Inactives' },
    { id: 'selected', label: 'Sélectionnées' },
  ];
  saveError = signal<string | null>(null);
  loading = signal(true);
  opened = signal(false);
  mode = signal<'detail' | 'create' | 'edit'>('detail');
  selected = signal<DocumentLink | null>(null);
  model = signal<DocumentLinkPayload>(blank());
  docForm = form(this.model, (p) => {
    required(p.title);
    required(p.url);
  });

  readonly filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    if (!q) return this.items();
    return this.items().filter((link) =>
      [link.title, link.description ?? '', link.category?.label ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  });

  readonly activeCategories = computed(() =>
    this.categories().filter((category) => category.isActive),
  );

  readonly categoryOptions = computed<SelectOption<number>[]>(() => [
    { value: NO_CATEGORY, label: 'Sans catégorie' },
    ...this.activeCategories().map((category) => ({ value: category.id, label: category.label })),
  ]);

  readonly filteredTeams = computed(() => {
    const q = this.teamSearch().toLowerCase().trim();
    const status = this.teamStatusFilter();
    const selected = new Set(this.model().teamIds ?? []);
    return this.teams().filter((team) => {
      if (status === 'active' && !team.isActive) return false;
      if (status === 'inactive' && team.isActive) return false;
      if (status === 'selected' && !selected.has(team.id)) return false;
      return !q || `${team.name} ${team.code}`.toLowerCase().includes(q);
    });
  });

  readonly selectedTeams = computed(() => {
    const ids = new Set(this.model().teamIds ?? []);
    return this.teams().filter((team) => ids.has(team.id));
  });

  ngOnInit(): void {
    this.reload();
    this.categoriesApi.list().subscribe({ next: (categories) => this.categories.set(categories) });
    this.teamsApi.list().subscribe({ next: (teams) => this.teams.set(teams) });
  }

  private reload(): void {
    this.loading.set(true);
    this.linksApi
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: (items) => this.items.set(items) });
  }

  open(link: DocumentLink): void {
    this.selected.set(link);
    this.mode.set('detail');
    this.opened.set(true);
  }

  create(): void {
    this.selected.set(null);
    this.model.set(blank());
    this.resetEditor();
    this.mode.set('create');
    this.opened.set(true);
  }

  edit(): void {
    const link = this.selected();
    if (!link) return;
    this.model.set({
      title: link.title,
      description: link.description ?? '',
      url: link.url,
      fileType: link.fileType,
      categoryId: link.categoryId,
      visibility: link.visibility,
      teamIds: link.teams.map((team) => team.id),
    });
    this.resetEditor();
    this.mode.set('edit');
  }

  private resetEditor(): void {
    this.teamSearch.set('');
    this.teamStatusFilter.set('all');
    this.saveError.set(null);
  }

  setTeamStatusFilter(status: TeamStatusFilter): void {
    this.teamStatusFilter.set(status);
  }

  selectFilteredTeams(): void {
    const ids = this.filteredTeams().map((team) => team.id);
    this.model.update((current) => ({
      ...current,
      teamIds: [...new Set([...(current.teamIds ?? []), ...ids])],
    }));
  }

  clearTeams(): void {
    this.model.update((current) => ({ ...current, teamIds: [] }));
  }

  setVisibility(visibility: DocumentVisibility): void {
    this.model.update((current) => ({ ...current, visibility }));
  }

  toggleTeam(teamId: number, checked: boolean): void {
    this.model.update((current) => {
      const teamIds = checked
        ? [...new Set([...(current.teamIds ?? []), teamId])]
        : (current.teamIds ?? []).filter((id) => id !== teamId);
      return { ...current, teamIds };
    });
  }

  isTeamSelected(teamId: number): boolean {
    return (this.model().teamIds ?? []).includes(teamId);
  }

  setCategory(value: number | null): void {
    this.model.update((current) => ({
      ...current,
      categoryId: value && value !== NO_CATEGORY ? value : null,
    }));
  }

  setFileType(value: DocumentFileType): void {
    this.model.update((current) => ({ ...current, fileType: value }));
  }

  teamNames(link: DocumentLink | null): string {
    if (!link || !link.teams.length) return '—';
    return link.teams.map((team) => team.name).join(', ');
  }

  save(): void {
    this.saveError.set(null);
    submit(this.docForm, async () => {
      const payload = this.model();
      if (payload.visibility === 'TEAMS' && (payload.teamIds ?? []).length === 0) {
        this.saveError.set('Choisissez au moins une équipe, ou ouvrez la fiche à tous.');
        return;
      }
      const request =
        this.mode() === 'create'
          ? this.linksApi.create(payload)
          : this.linksApi.update(this.selected()!.id, payload);
      request.subscribe({
        next: () => {
          this.opened.set(false);
          this.reload();
        },
        error: (error: { error?: { message?: string | string[] } }) => {
          const message = error?.error?.message;
          this.saveError.set(
            (Array.isArray(message) ? message.join(' ') : message) ??
              "L'enregistrement a échoué. Vérifiez les champs et réessayez.",
          );
        },
      });
    });
  }

  remove(): void {
    const link = this.selected();
    if (!link) return;
    this.linksApi.delete(link.id).subscribe(() => {
      this.opened.set(false);
      this.reload();
    });
  }
}
