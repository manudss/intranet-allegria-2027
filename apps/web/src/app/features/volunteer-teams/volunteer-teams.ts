import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { VolunteerTeam, VolunteerTeamPayload } from '../../models/models';
import { VolunteerTeamsApiService } from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { DataTableColumn } from '../../shared/data-table';

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
  template: `<app-page-layout title="Équipes opérationnelles" description="Équipes bénévoles et rattachements">
      @if (canWrite()) {
        <button actions tuiButton (click)="create()">Nouvelle équipe</button>
      }
      <tui-textfield iconStart="@tui.search">
        <label for="rechercher-une-equipe" tuiLabel>Rechercher une équipe</label><input tuiInput placeholder="Nom ou code…" [value]="query()" (input)="query.set($any($event.target).value)" id="rechercher-une-equipe" />
      </tui-textfield>
      @if (loading()) {
        <tui-loader />
      } @else {
        <app-data-table [rows]="filtered()" [columns]="tableColumns" (rowSelected)="open($event)" />
      }
    </app-page-layout>
    @if (opened()) {
      <tui-drawer direction="end">
        <header>
          <h2>{{ mode() === 'create' ? 'Nouvelle équipe opérationnelle' : selected()?.name }}</h2>
        </header>
        @if (mode() === 'detail') {
          <dl>
            <dt>Code</dt>
            <dd>{{ selected()?.code }}</dd>
            <dt>Description</dt>
            <dd>{{ selected()?.description || '—' }}</dd>
            <dt>Statut</dt>
            <dd>{{ selected()?.isActive ? 'Active' : 'Inactive' }}</dd>
            <dt>Créée le</dt>
            <dd>{{ selected()?.createdAt | date: 'short' }}</dd>
            <dt>Modifiée le</dt>
            <dd>{{ selected()?.updatedAt | date: 'short' }}</dd>
          </dl>
        } @else {
          <form class="drawer-form">
            <tui-textfield iconStart="@tui.briefcase">
              <label for="nom-2" tuiLabel>Nom</label><input tuiInput [formField]="teamForm.name" id="nom-2" />
            </tui-textfield>
            <tui-textfield iconStart="@tui.hash">
              <label for="code-2" tuiLabel>Code</label><input tuiInput [formField]="teamForm.code" id="code-2" />
            </tui-textfield>
            <label class="check">
              <input type="checkbox" [formField]="teamForm.isActive" /> Active
            </label>
            <tui-textfield iconStart="@tui.file-text" class="wide">
              <label for="description-2" tuiLabel>Description</label><textarea tuiTextarea [formField]="$any(teamForm.description)" id="description-2"></textarea>
            </tui-textfield>
          </form>
        }
        <footer>
          <button tuiButton appearance="flat" (click)="opened.set(false)">Fermer</button>
          @if (mode() === 'detail') {
            @if (canWrite()) {
              <button tuiButton (click)="edit()">Modifier</button>
              <button tuiButton appearance="secondary-destructive" (click)="remove()">Supprimer</button>
            }
          } @else {
            <button tuiButton (click)="save()">Enregistrer</button>
          }
        </footer>
      </tui-drawer>
    }`,
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
    },
    {
      key: 'code',
      label: 'Code',
      type: 'list',
      value: (team) => team.code,
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.hash' },
    },
    {
      key: 'status',
      label: 'Statut',
      type: 'list',
      value: (team) => (team.isActive ? 'Active' : 'Inactive'),
      presentation: { type: 'badge' },
    },
    {
      key: 'description',
      label: 'Description',
      type: 'text',
      value: (team) => team.description || '—',
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
    return this.items().filter((team) => `${team.name} ${team.code} ${team.description ?? ''}`.toLowerCase().includes(q));
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
          this.mode() === 'create' ? [...items, team] : items.map((item) => (item.id === team.id ? team : item)),
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
