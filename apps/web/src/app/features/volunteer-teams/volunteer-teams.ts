import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { VolunteerTeam, VolunteerTeamPayload } from '../../models/models';
import { VolunteerTeamsApiService } from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { DataTableColumn } from '../../shared/data-table';

function formatDateTime(datetimeStr: string | undefined): string {
  if (!datetimeStr) return '—';
  const date = new Date(datetimeStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const blank = (): VolunteerTeamPayload => ({
  name: '',
  code: '',
  description: '',
  isActive: true,
});

@Component({
  selector: 'app-volunteer-teams',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './volunteer-teams.html',
  styleUrls: ['../../shared/crud.scss'],
})
export class VolunteerTeamsPage implements OnInit {
  protected readonly tableColumns: readonly DataTableColumn<VolunteerTeam>[] = [
    {
      key: 'name',
      label: 'Équipe',
      type: 'text',
      value: (team) => team.name,
      presentation: { type: 'icon', icon: () => '@tui.users' },
      size: 'large',
    },
    {
      key: 'code',
      label: 'Code',
      type: 'list',
      value: (team) => team.code,
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.hash' },
      size: 'xsmall',
    },
    {
      key: 'isActive',
      label: 'Actif',
      type: 'list',
      value: (team) => team.isActive,
      presentation: { type: 'boolean' },
      size: 'xsmall',
    },
    {
      key: 'description',
      label: 'Description',
      type: 'text',
      value: (team) => team.description || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.note' },
      size: 'xlarge',
    },
    {
      key: 'memberships',
      label: 'Membres',
      type: 'text',
      value: (team) => (team.memberships ? team.memberships.map((m) => `${m.volunteer.lastName} ${m.volunteer.firstName}`).join(', ') : '—'),
      hidden: true,
      presentation: {
        type: 'chips',
        autoColor: true,
        values: (team) => team.memberships?.map((m) => `${m.volunteer.lastName} ${m.volunteer.firstName}`) || [],
      },
      size: 'xlarge',
    },
    {
      key: 'createdAt',
      label: 'Créé le',
      type: 'date',
      value: (team) => formatDateTime(team.createdAt),
      filterValue: (team) => team.createdAt,
      hidden: true,
      presentation: { type: 'date' },
      size: 'large',
    },
    {
      key: 'updatedAt',
      label: 'Modifié le',
      type: 'date',
      value: (team) => formatDateTime(team.updatedAt),
      filterValue: (team) => team.updatedAt,
      hidden: true,
      presentation: { type: 'date' },
      size: 'large',
    },
  ];

  private readonly api = inject(VolunteerTeamsApiService);
  private readonly auth = inject(AuthService);

  items = signal<VolunteerTeam[]>([]);
  query = signal('');
  loading = signal(true);
  opened = signal(false);
  mode = signal<'detail' | 'create' | 'edit'>('detail');
  selected = signal<VolunteerTeam | null>(null);
  model = signal<VolunteerTeamPayload>(blank());
  teamForm = form(this.model, (p) => {
    required(p.name);
    required(p.code);
  });

  readonly canWrite = computed(() => this.auth.hasAnyRole(['ADMIN', 'COORDINATOR']));

  filtered = computed(() => {
    const q = this.query().toLowerCase();
    return this.items().filter((team) =>
      `${team.name} ${team.code} ${team.description ?? ''}`.toLowerCase().includes(q),
    );
  });

  ngOnInit(): void {
    this.api
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((items) => this.items.set(items));
  }

  open(team: VolunteerTeam): void {
    this.selected.set(team);
    this.mode.set('detail');
    this.opened.set(true);
  }

  create(): void {
    this.model.set(blank());
    this.selected.set(null);
    this.mode.set('create');
    this.opened.set(true);
  }

  edit(): void {
    const team = this.requireSelectedTeam();
    this.model.set({
      name: team.name,
      code: team.code,
      description: team.description ?? '',
      isActive: team.isActive,
    });
    this.mode.set('edit');
  }

  save(): void {
    submit(this.teamForm, async () => {
      const request =
        this.mode() === 'create'
          ? this.api.create(this.model())
          : this.api.update(this.requireSelectedTeam().id, this.model());

      request.subscribe((team) => {
        this.items.update((items) =>
          this.mode() === 'create'
            ? [...items, team]
            : items.map((item) => (item.id === team.id ? team : item)),
        );
        this.open(team);
      });
    });
  }

  remove(): void {
    const team = this.requireSelectedTeam();

    if (confirm(`Supprimer ${team.name} ?`)) {
      this.api.delete(team.id).subscribe(() => {
        this.items.update((items) => items.filter((item) => item.id !== team.id));
        this.opened.set(false);
      });
    }
  }

  private requireSelectedTeam(): VolunteerTeam {
    const team = this.selected();

    if (!team) {
      throw new Error('No volunteer team selected');
    }

    return team;
  }
}
